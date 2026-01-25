/**
 * Python Process Manager
 * Handles spawning, communicating with, and managing the Python backend
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface Command {
  id: string;
  command: string;
  [key: string]: any;
}

interface Response {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

export class PythonManager extends EventEmitter {
  private pythonExePath: string;
  private pythonScriptPath: string;
  private process: ChildProcess | null = null;
  private isRunning: boolean = false;
  private currentState: string = 'idle';
  private commandQueue: Command[] = [];
  private pendingCommands: Map<string, (response: Response) => void> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 2000;
  private ipcToken: string = '';
  private tokenFilePath: string = '';

  constructor(pythonExePath: string, pythonScriptPath: string) {
    super();
    this.pythonExePath = pythonExePath;
    this.pythonScriptPath = pythonScriptPath;
    this.tokenFilePath = path.join(os.homedir(), '.diktate', '.ipc_token');
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
   */
  async start(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        logger.info('PythonManager', 'Starting Python process', { scriptPath: this.pythonScriptPath });

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

        // Prepare environment with IPC token
        const env = {
          ...process.env,
          DIKTATE_IPC_TOKEN: this.ipcToken
        };

        this.process = spawn(this.pythonExePath, [this.pythonScriptPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          detached: false,
          cwd: require('path').dirname(this.pythonScriptPath),
          env: env
        });

        if (!this.process) {
          throw new Error('Failed to spawn Python process');
        }

        // Setup output handlers
        this.process.stdout?.on('data', (data) => {
          this.handlePythonOutput(data.toString());
        });

        this.process.stderr?.on('data', (data) => {
          const line = data.toString().trim();
          if (!line) return;

          // Smart log level detection for Python standard logging
          if (line.includes(' - INFO - ')) {
            logger.info('Python', line);
          } else if (line.includes(' - WARNING - ') || line.includes('UserWarning:') || line.includes('DeprecationWarning:')) {
            logger.warn('Python', line);
          } else if (line.includes(' - DEBUG - ')) {
            logger.debug('Python', line);
          } else {
            // Default to error for stderr if no clear level is found
            logger.error('Python', line);
          }
        });

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

        resolve();
      } catch (error) {
        logger.error('PythonManager', 'Failed to start process', error);
        reject(error);
      }
    });
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
        command: 'shutdown'
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
  async setConfig(config: object): Promise<any> {
    return this.sendCommand('configure', { config });
  }

  /**
   * Send a command to Python
   */
  async sendCommand(command: string, data?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.isRunning) {
        reject(new Error('Python process not running'));
        return;
      }

      const commandId = `${Date.now()}-${Math.random()}`;
      const fullCommand: Command = {
        id: commandId,
        command,
        ...data
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
   * Handle output from Python process
   */
  private handlePythonOutput(output: string): void {
    const lines = output.split('\n').filter((line) => line.trim());

    for (const line of lines) {
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
  }

  /**
   * Handle events from Python process
   */
  private handlePythonEvent(event: any): void {
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
        error: 'Python process crashed'
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
        maxAttempts: this.maxReconnectAttempts
      });
      this.emit('fatal-error', new Error('Python process connection lost'));
      return;
    }

    this.reconnectAttempts++;
    logger.info('PythonManager', 'Attempting to reconnect', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts
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
