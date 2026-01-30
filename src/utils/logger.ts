/**
 * Logger utility for Electron main process
 * Writes logs to both file and console
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

class Logger {
  private logFilePath: string;
  private logStream: fs.WriteStream | null = null;
  private initialized: boolean = false;

  constructor() {
    // Initialize will be called from initialize() method
    this.logFilePath = '';
  }

  /**
   * Initialize logger (must be called after app is ready)
   */
  initialize(): void {
    if (this.initialized) return;

    const userDataPath = app.getPath('userData');
    const logsDir = path.join(userDataPath, 'logs');

    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Create log file with timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    this.logFilePath = path.join(logsDir, `electron-${timestamp}.log`);

    // Create write stream
    this.logStream = fs.createWriteStream(this.logFilePath, { flags: 'a' });

    this.initialized = true;
    this.info('Logger', 'Logger initialized', { logFile: this.logFilePath });
  }

  /**
   * Format log message
   */
  private formatMessage(level: LogLevel, source: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
    return `${timestamp} [${level}] [${source}] ${message}${dataStr}`;
  }

  private onLogCallback: ((level: LogLevel, message: string, data?: any) => void) | null = null;

  /**
   * Set callback for log streaming
   */
  setLogCallback(callback: (level: LogLevel, message: string, data?: any) => void): void {
    this.onLogCallback = callback;
  }

  private consoleThreshold: LogLevel = LogLevel.INFO;

  /**
   * Set the threshold for console logging
   */
  setConsoleThreshold(level: LogLevel): void {
    this.consoleThreshold = level;
  }

  /**
   * Write log to file and console
   */
  private log(level: LogLevel, source: string, message: string, data?: any): void {
    const formattedMessage = this.formatMessage(level, source, message, data);

    // Map log levels to numeric values for comparison
    const levelMap: Record<LogLevel, number> = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 1,
      [LogLevel.WARN]: 2,
      [LogLevel.ERROR]: 3
    };

    // Write to console with threshold check and safety check
    if (levelMap[level] >= levelMap[this.consoleThreshold]) {
      try {
        switch (level) {
          case LogLevel.ERROR:
            console.error(formattedMessage);
            break;
          case LogLevel.WARN:
            console.warn(formattedMessage);
            break;
          case LogLevel.DEBUG:
          case LogLevel.INFO:
          default:
            console.log(formattedMessage);
            break;
        }
      } catch (error: any) {
        // Ignore EPIPE errors (broken pipe to stdout)
        if (error.code !== 'EPIPE') {
          try { process.stderr.write(`Logger error: ${error.message}\n`); } catch (e) { /* ignore */ }
        }
      }
    }

    // Write to file (always, regardless of console threshold)
    if (this.logStream && this.initialized) {
      this.logStream.write(formattedMessage + '\n');
    }

    // Stream to callback (always, the listener can filter)
    if (this.onLogCallback) {
      this.onLogCallback(level, `[${source}] ${message}`, data);
    }
  }

  /**
   * Log debug message
   */
  debug(source: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, source, message, data);
  }

  /**
   * Log info message
   */
  info(source: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, source, message, data);
  }

  /**
   * Log warning message
   */
  warn(source: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, source, message, data);
  }

  /**
   * Log error message
   */
  error(source: string, message: string, error?: any): void {
    const errorData = error instanceof Error
      ? { message: error.message, stack: error.stack }
      : error;
    this.log(LogLevel.ERROR, source, message, errorData);
  }

  /**
   * Close log stream
   */
  close(): void {
    if (this.logStream) {
      this.logStream.end();
      this.logStream = null;
    }
    this.initialized = false;
  }

  /**
   * Get log file path
   */
  getLogFilePath(): string {
    return this.logFilePath;
  }
}

// Export singleton instance
export const logger = new Logger();
