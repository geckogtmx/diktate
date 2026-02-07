/**
 * Python Process Manager
 * Handles spawning, communicating with, and managing the Python backend
 */

import { spawn, ChildProcess } from 'child_process';
import * as readline from 'readline';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface Command {
  id: string;
  command: string;
  [key: string]: unknown;
}

interface Response {
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

export class PythonManager extends EventEmitter {
  private pythonExePath: string;
  private pythonScriptPath: string;
  private process: ChildProcess | null = null;
  private isRunning: boolean = false;
  private currentState: string = 'warmup'; // SPEC_035: Start in warmup to match backend
  private commandQueue: Command[] = [];
  private pendingCommands: Map<string, (response: Response) => void> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 2000;
  private ipcToken: string = '';
  private tokenFilePath: string = '';
  private isSyncing: boolean = false; // SPEC_035: Track config sync phase

  constructor(pythonExePath: string, pythonScriptPath: string) {
    super();
    this.pythonExePath = pythonExePath;
    this.pythonScriptPath = pythonScriptPath;
    this.tokenFilePath = path.join(os.homedir(), '.diktate', '.ipc_token');
    this.currentState = 'warmup'; // Guarantee warmup state at start
  }

  /**
   * Generate a cryptographically secure random token
   */
  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Write token to file for external tools
   */
  private async writeTokenFile(): Promise<void> {
    try {
      const tokenDir = path.dirname(this.tokenFilePath);

      // Create .diktate directory if it doesn't exist
      if (!fs.existsSync(tokenDir)) {
        fs.mkdirSync(tokenDir, { recursive: true });
        logger.info('PythonManager', 'Created .diktate directory', { path: tokenDir });
      }

      // Remove existing token file if present (it may be read-only from previous run)
      if (fs.existsSync(this.tokenFilePath)) {
        try {
          fs.chmodSync(this.tokenFilePath, 0o600); // Make writable first
          fs.unlinkSync(this.tokenFilePath);
        } catch (unlinkError) {
          logger.warn(
            'PythonManager',
            'Failed to remove old token file, will attempt overwrite',
            unlinkError
          );
        }
      }

      // Write token to file
      fs.writeFileSync(this.tokenFilePath, this.ipcToken, { mode: 0o400 });
      logger.info('PythonManager', 'Token file created', { path: this.tokenFilePath });
    } catch (error) {
      logger.error('PythonManager', 'Failed to write token file', error);
      throw error;
    }
  }

  /**
   * Clean up token file on exit
   */
  private cleanupTokenFile(): void {
    try {
      if (fs.existsSync(this.tokenFilePath)) {
        fs.unlinkSync(this.tokenFilePath);
        logger.info('PythonManager', 'Token file cleaned up');
      }
    } catch (error) {
      logger.warn('PythonManager', 'Failed to cleanup token file', error);
    }
  }

  /**
   * Start the Python process
   * @param whisperModel - Optional Whisper model size (SPEC_041)
   */
  async start(whisperModel?: string): Promise<void> {
    try {
      logger.info('PythonManager', 'Starting Python process', {
        scriptPath: this.pythonScriptPath,
        whisperModel: whisperModel || 'turbo',
      });

      // Generate IPC authentication token
      this.ipcToken = this.generateToken();
      logger.debug('PythonManager', 'Generated IPC authentication token');

      // Write token to file for external tools
      try {
        await this.writeTokenFile();
      } catch (error) {
        logger.error('PythonManager', 'Failed to write token file, continuing without it', error);
        // Continue even if token file writing fails
      }

      // Prepare environment with IPC token and Whisper model (SPEC_041)
      const env = {
        ...process.env,
        DIKTATE_IPC_TOKEN: this.ipcToken,
        WHISPER_MODEL: whisperModel || 'turbo',
      };

      this.process = spawn(this.pythonExePath, ['-u', this.pythonScriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false,
        cwd: path.dirname(this.pythonScriptPath),
        env: env,
      });

      if (!this.process) {
        throw new Error('Failed to spawn Python process');
      }

      // Setup output handlers
      if (this.process.stdout) {
        const stdoutReader = readline.createInterface({
          input: this.process.stdout,
          terminal: false,
        });
        stdoutReader.on('line', (line) => {
          setImmediate(() => this.handlePythonLine(line));
        });
      }

      if (this.process.stderr) {
        const stderrReader = readline.createInterface({
          input: this.process.stderr,
          terminal: false,
        });
        stderrReader.on('line', (line) => {
          // SPEC_035: Aggressive decimation - don't even schedule the task if it's just noisy INFO during warmup
          if (this.currentState === 'warmup') {
            if (line.includes(' - INFO - ') || line.includes(' - DEBUG - ')) {
              return;
            }
          }
          setImmediate(() => this.handlePythonStderr(line));
        });
      }

      this.process.on('error', (error) => {
        logger.error('PythonManager', 'Process error occurred', error);
        this.emit('error', error);
        this.handleProcessError();
      });

      this.process.on('exit', (code) => {
        logger.warn('PythonManager', 'Python process exited', { exitCode: code });
        this.isRunning = false;
        this.process = null;
        this.emit('disconnected');
        this.attemptReconnect();
      });

      this.isRunning = true;
      this.reconnectAttempts = 0;
      this.emit('ready');

      return Promise.resolve();
    } catch (error) {
      logger.error('PythonManager', 'Failed to start process', error);
      throw error;
    }
  }

  /**
   * Stop the Python process
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.process) {
        this.cleanupTokenFile();
        resolve();
        return;
      }

      logger.info('PythonManager', 'Stopping Python process');

      this.isRunning = false;

      // Send shutdown command
      this.sendRawCommand({
        id: 'shutdown',
        command: 'shutdown',
      });

      // Force kill after 5 seconds
      const timeout = setTimeout(() => {
        if (this.process) {
          this.process.kill();
        }
        this.cleanupTokenFile();
        resolve();
      }, 5000);

      this.process.on('exit', () => {
        clearTimeout(timeout);
        this.cleanupTokenFile();
        resolve();
      });
    });
  }

  /**
   * Set configuration for the Python pipeline
   */
  async setConfig(config: object): Promise<unknown> {
    this.isSyncing = true;
    try {
      // Yield to let UI process any pending clicks before heavy sync
      await new Promise((resolve) => setImmediate(resolve));
      const result = await this.sendCommand('configure', { config });
      return result;
    } finally {
      // Small delay before turning logs back on to catch trailing noise
      setTimeout(() => {
        this.isSyncing = false;
      }, 500);
    }
  }

  /**
   * Send a command to Python
   */
  async sendCommand(command: string, data?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.isRunning) {
        reject(new Error('Python process not running'));
        return;
      }

      const commandId = `${Date.now()}-${Math.random()}`;
      const fullCommand: Command = {
        id: commandId,
        command,
        ...data,
      };

      // Register response handler
      this.pendingCommands.set(commandId, (response: Response) => {
        if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.error || 'Unknown error'));
        }
      });

      // Send command
      this.sendRawCommand(fullCommand);

      // Timeout after 60 seconds
      setTimeout(() => {
        if (this.pendingCommands.has(commandId)) {
          this.pendingCommands.delete(commandId);
          reject(new Error('Command timeout'));
        }
      }, 60000);
    });
  }

  /**
   * Send raw JSON command to Python
   */
  private sendRawCommand(command: Command): void {
    if (!this.process || !this.process.stdin) {
      logger.error('PythonManager', 'No stdin available for process');
      return;
    }

    try {
      const json = JSON.stringify(command) + '\n';
      this.process.stdin.write(json);
    } catch (error) {
      logger.error('PythonManager', 'Failed to send command', error);
    }
  }

  /**
   * Handle a single line of output from Python process
   */
  private handlePythonLine(line: string): void {
    if (!line.trim()) return;

    try {
      // Try to parse as JSON (response)
      const data = JSON.parse(line);

      if (data.id) {
        // It's a response to a command
        const handler = this.pendingCommands.get(data.id);
        if (handler) {
          handler(data as Response);
          this.pendingCommands.delete(data.id);
        }
      } else if (data.event) {
        // It's an event
        this.handlePythonEvent(data);
      }
    } catch {
      // Not JSON, just log it
      logger.debug('Python', line);
    }
  }

  /**
   * Handle a single line of stderr from Python
   */
  private handlePythonStderr(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Smart log level detection for Python standard logging
    const isInfo = line.includes(' - INFO - ');
    const isWarn =
      line.includes(' - WARNING - ') ||
      line.includes('UserWarning:') ||
      line.includes('DeprecationWarning:');
    const isDebug = line.includes(' - DEBUG - ');
    const isError =
      line.includes(' - ERROR - ') || line.includes('Exception:') || line.includes('Error:');

    // SPEC_035: Total silence during warmup OR initial sync for ANYTHING that isn't a critical error
    // This is the absolute key to preventing the 12-15s event loop stall on Windows
    if (this.currentState === 'warmup' || this.isSyncing) {
      if (!isError && !isWarn) {
        return; // Silent discard
      }
    }

    if (isInfo) {
      logger.info('Python', line);
    } else if (isWarn) {
      logger.warn('Python', line);
    } else if (isDebug) {
      logger.debug('Python', line);
    } else if (isError) {
      logger.error('Python', line);
    } else {
      // Default to DEBUG for unknown noise instead of ERROR
      // This ensures it goes to file but NOT to console (blocking) in production
      logger.debug('Python', line);
    }
  }

  /**
   * Handle events from Python process
   */
  private handlePythonEvent(event: Record<string, unknown>): void {
    logger.debug('PythonManager', 'Event from Python', { eventType: event.event });

    if (event.event === 'state-change') {
      this.currentState = event.state;
      this.emit('state-change', event.state);
    } else if (event.event === 'error') {
      this.emit('error', new Error(event.message));
    } else if (event.event === 'performance-metrics') {
      this.emit('performance-metrics', event);
    } else if (event.event === 'ask-response') {
      // Forward ask-response event for Q&A mode
      this.emit('ask-response', event);
    } else if (event.event === 'processor-fallback') {
      // Forward processor fallback event for error recovery
      this.emit('processor-fallback', event);
    } else if (event.event === 'recording-auto-stopped') {
      // Forward recording auto-stop event
      this.emit('recording-auto-stopped', event);
    } else if (event.event === 'status-check') {
      this.emit('status-check', event);
    } else if (event.event === 'refine-success') {
      this.emit('refine-success', event);
    } else if (event.event === 'refine-error') {
      this.emit('refine-error', event);
    } else if (event.event === 'refine-instruction-success') {
      this.emit('refine-instruction-success', event);
    } else if (event.event === 'refine-instruction-fallback') {
      this.emit('refine-instruction-fallback', event);
    } else if (event.event === 'refine-instruction-error') {
      this.emit('refine-instruction-error', event);
    } else if (event.event === 'system-metrics') {
      this.emit('system-metrics', event);
    } else if (event.event === 'mic-muted') {
      this.emit('mic-muted', event);
    } else if (event.event === 'mic-status') {
      this.emit('mic-status', event);
    } else if (event.event === 'api-error') {
      this.emit('api-error', event);
    } else if (event.event === 'dictation-success') {
      this.emit('dictation-success', event);
    }
  }

  /**
   * Handle process error
   */
  private handleProcessError(): void {
    // Reject all pending commands
    for (const handler of this.pendingCommands.values()) {
      handler({
        id: '',
        success: false,
        error: 'Python process crashed',
      });
    }
    this.pendingCommands.clear();
  }

  /**
   * Attempt to reconnect to Python process
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('PythonManager', 'Max reconnection attempts reached', {
        attempts: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
      });
      this.emit('fatal-error', new Error('Python process connection lost'));
      return;
    }

    this.reconnectAttempts++;
    logger.info('PythonManager', 'Attempting to reconnect', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
    });

    setTimeout(() => {
      this.start().catch((error) => {
        logger.error('PythonManager', 'Reconnection attempt failed', error);
      });
    }, this.reconnectDelay);
  }

  /**
   * Get current process status
   */
  getStatus(): string {
    return this.currentState;
  }

  /**
   * Check if process is running
   */
  isProcessRunning(): boolean {
    return this.isRunning;
  }
}
