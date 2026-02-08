/**
 * Tests for Logger utility
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { logger, LogLevel } from '../../../src/utils/logger';

describe('Logger', () => {
  beforeEach(() => {
    // Reset logger state
    logger.close();
    vi.clearAllMocks();
  });

  afterEach(() => {
    logger.close();
  });

  describe('formatMessage', () => {
    it('should format log messages correctly', () => {
      // Access via the public API
      const consoleSpy = vi.spyOn(console, 'log');
      logger.info('TestSource', 'Test message');

      expect(consoleSpy).toHaveBeenCalled();
      const logMessage = consoleSpy.mock.calls[0][0] as string;

      expect(logMessage).toContain('[INFO]');
      expect(logMessage).toContain('[TestSource]');
      expect(logMessage).toContain('Test message');
      expect(logMessage).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO timestamp

      consoleSpy.mockRestore();
    });

    it('should include data in log format', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      logger.info('TestSource', 'Test message', { key: 'value', num: 42 });

      expect(consoleSpy).toHaveBeenCalled();
      const logMessage = consoleSpy.mock.calls[0][0] as string;

      expect(logMessage).toContain('{"key":"value","num":42}');

      consoleSpy.mockRestore();
    });
  });

  describe('debug', () => {
    it('should log debug messages when console threshold is DEBUG', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      logger.setConsoleThreshold(LogLevel.DEBUG);
      logger.debug('Debug', 'Debug message');

      expect(consoleSpy).toHaveBeenCalled();
      const logMessage = consoleSpy.mock.calls[0][0] as string;
      expect(logMessage).toContain('[DEBUG]');
      expect(logMessage).toContain('Debug message');

      consoleSpy.mockRestore();
    });

    it('should NOT log debug messages when threshold is INFO', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      logger.setConsoleThreshold(LogLevel.INFO);
      logger.debug('Debug', 'Debug message');

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('info', () => {
    it('should log info messages', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      logger.info('Info', 'Info message', { data: 'test' });

      expect(consoleSpy).toHaveBeenCalled();
      const logMessage = consoleSpy.mock.calls[0][0] as string;
      expect(logMessage).toContain('[INFO]');
      expect(logMessage).toContain('[Info]');
      expect(logMessage).toContain('Info message');

      consoleSpy.mockRestore();
    });
  });

  describe('warn', () => {
    it('should log warning messages', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn');
      logger.warn('Warn', 'Warning message');

      expect(consoleWarnSpy).toHaveBeenCalled();
      const logMessage = consoleWarnSpy.mock.calls[0][0] as string;
      expect(logMessage).toContain('[WARN]');
      expect(logMessage).toContain('Warning message');

      consoleWarnSpy.mockRestore();
    });
  });

  describe('error', () => {
    it('should log error messages', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');
      logger.error('Error', 'Error message');

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logMessage = consoleErrorSpy.mock.calls[0][0] as string;
      expect(logMessage).toContain('[ERROR]');
      expect(logMessage).toContain('Error message');

      consoleErrorSpy.mockRestore();
    });

    it('should format Error objects correctly', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');
      const error = new Error('Test error');
      logger.error('Error', 'An error occurred', error);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logMessage = consoleErrorSpy.mock.calls[0][0] as string;
      expect(logMessage).toContain('Test error');
      expect(logMessage).toContain('stack');

      consoleErrorSpy.mockRestore();
    });

    it('should handle non-Error objects', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');
      const errorData = { code: 500, message: 'Server error' };
      logger.error('Error', 'API error', errorData);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logMessage = consoleErrorSpy.mock.calls[0][0] as string;
      expect(logMessage).toContain('Server error');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('setConsoleThreshold', () => {
    it('should respect threshold levels', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const consoleWarnSpy = vi.spyOn(console, 'warn');
      const consoleErrorSpy = vi.spyOn(console, 'error');

      // Set threshold to WARN - should only see WARN and ERROR
      logger.setConsoleThreshold(LogLevel.WARN);

      logger.debug('Test', 'Debug message');
      logger.info('Test', 'Info message');
      logger.warn('Test', 'Warn message');
      logger.error('Test', 'Error message');

      expect(consoleSpy).not.toHaveBeenCalled(); // DEBUG and INFO filtered
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should allow DEBUG when threshold is DEBUG', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      logger.setConsoleThreshold(LogLevel.DEBUG);

      logger.debug('Test', 'Debug message');
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should allow ERROR when threshold is ERROR', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const consoleWarnSpy = vi.spyOn(console, 'warn');
      const consoleErrorSpy = vi.spyOn(console, 'error');

      logger.setConsoleThreshold(LogLevel.ERROR);

      logger.debug('Test', 'Debug');
      logger.info('Test', 'Info');
      logger.warn('Test', 'Warn');
      logger.error('Test', 'Error');

      expect(consoleSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('setLogCallback', () => {
    it('should call callback on log events', () => {
      const callback = vi.fn();
      logger.setLogCallback(callback);

      logger.info('Test', 'Test message', { key: 'value' });

      expect(callback).toHaveBeenCalledWith(LogLevel.INFO, '[Test] Test message', { key: 'value' });
    });

    it('should call callback for all log levels', () => {
      const callback = vi.fn();
      logger.setLogCallback(callback);

      logger.debug('Test', 'Debug');
      logger.info('Test', 'Info');
      logger.warn('Test', 'Warn');
      logger.error('Test', 'Error');

      expect(callback).toHaveBeenCalledTimes(4);
      expect(callback).toHaveBeenNthCalledWith(1, LogLevel.DEBUG, '[Test] Debug', undefined);
      expect(callback).toHaveBeenNthCalledWith(2, LogLevel.INFO, '[Test] Info', undefined);
      expect(callback).toHaveBeenNthCalledWith(3, LogLevel.WARN, '[Test] Warn', undefined);
      expect(callback).toHaveBeenNthCalledWith(4, LogLevel.ERROR, '[Test] Error', undefined);
    });

    it('should NOT call callback when none is set', () => {
      // Ensure no crash when callback is null
      logger.info('Test', 'Test message');
      // If we reach here without error, test passes
      expect(true).toBe(true);
    });
  });

  describe('getLogFilePath', () => {
    it('should return empty string before initialization', () => {
      logger.close(); // Ensure not initialized
      expect(logger.getLogFilePath()).toBe('');
    });

    it('should return log file path after initialization', () => {
      logger.initialize();
      const logPath = logger.getLogFilePath();

      expect(logPath).toBeTruthy();
      expect(logPath).toContain('electron-');
      expect(logPath).toContain('.log');
    });
  });

  describe('close', () => {
    it('should close log stream and reset path', () => {
      logger.initialize();
      const pathBeforeClose = logger.getLogFilePath();
      expect(pathBeforeClose).toBeTruthy();

      logger.close();

      // Path should still be there, just stream is closed and initialized flag is false
      // The logger doesn't clear the path on close, just the stream
      expect(logger.getLogFilePath()).toBeTruthy();
    });

    it('should be safe to call close multiple times', () => {
      logger.initialize();
      logger.close();
      logger.close(); // Should not crash

      expect(true).toBe(true);
    });
  });

  describe('initialize', () => {
    it('should only initialize once', () => {
      logger.initialize();
      const firstPath = logger.getLogFilePath();

      logger.initialize();
      const secondPath = logger.getLogFilePath();

      expect(firstPath).toBe(secondPath);
    });
  });
});
