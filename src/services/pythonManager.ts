/**
 * Python Process Manager
 * Handles spawning, communicating with, and managing the Python backend
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

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

  constructor(pythonExePath: string, pythonScriptPath: string) {
    super();
    this.pythonExePath = pythonExePath;
    this.pythonScriptPath = pythonScriptPath;
  }

  /**
   * Start the Python process
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log(`[PythonManager] Starting Python process: ${this.pythonScriptPath}`);

        this.process = spawn(this.pythonExePath, [this.pythonScriptPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          detached: false,
          cwd: require('path').dirname(this.pythonScriptPath)
        });

        if (!this.process) {
          throw new Error('Failed to spawn Python process');
        }

        // Setup output handlers
        this.process.stdout?.on('data', (data) => {
          this.handlePythonOutput(data.toString());
        });

        this.process.stderr?.on('data', (data) => {
          console.error(`[Python] ${data.toString()}`);
        });

        this.process.on('error', (error) => {
          console.error(`[PythonManager] Process error:`, error);
          this.emit('error', error);
          this.handleProcessError();
        });

        this.process.on('exit', (code) => {
          console.log(`[PythonManager] Python process exited with code ${code}`);
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
        console.error('[PythonManager] Failed to start:', error);
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
        resolve();
        return;
      }

      console.log('[PythonManager] Stopping Python process...');

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
        resolve();
      }, 5000);

      this.process.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
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
      console.error('[PythonManager] No stdin available');
      return;
    }

    try {
      const json = JSON.stringify(command) + '\n';
      this.process.stdin.write(json);
    } catch (error) {
      console.error('[PythonManager] Failed to send command:', error);
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
        console.log(`[Python] ${line}`);
      }
    }
  }

  /**
   * Handle events from Python process
   */
  private handlePythonEvent(event: any): void {
    console.log(`[PythonManager] Event from Python:`, event.event);

    if (event.event === 'state-change') {
      this.currentState = event.state;
      this.emit('state-change', event.state);
    } else if (event.event === 'error') {
      this.emit('error', new Error(event.message));
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
      console.error('[PythonManager] Max reconnection attempts reached');
      this.emit('fatal-error', new Error('Python process connection lost'));
      return;
    }

    this.reconnectAttempts++;
    console.log(`[PythonManager] Reconnecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    setTimeout(() => {
      this.start().catch((error) => {
        console.error('[PythonManager] Reconnection failed:', error);
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
