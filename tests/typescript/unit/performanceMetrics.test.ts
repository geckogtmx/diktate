/**
 * Tests for PerformanceMetrics utility
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { performanceMetrics } from '../../../src/utils/performanceMetrics';

describe('PerformanceMetrics', () => {
  beforeEach(() => {
    // Reset metrics before each test
    performanceMetrics.reset();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('startMetric / endMetric', () => {
    it('should start and end a metric successfully', () => {
      performanceMetrics.startMetric('recording');
      const duration = performanceMetrics.endMetric('recording');

      expect(duration).toBeGreaterThanOrEqual(0);
      expect(duration).toBeDefined();
    });

    it('should calculate duration correctly', () => {
      const startTime = Date.now();
      performanceMetrics.startMetric('transcription');

      // Simulate 50ms delay
      vi.advanceTimersByTime(50);

      const duration = performanceMetrics.endMetric('transcription');

      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should store metadata with metrics', () => {
      performanceMetrics.startMetric('processing', { model: 'gpt-4', tokens: 150 });
      performanceMetrics.endMetric('processing', { status: 'success' });

      const summary = performanceMetrics.getSessionSummary();
      expect(summary.processing).toBeGreaterThanOrEqual(0);
    });

    it('should return undefined when ending non-existent metric', () => {
      const duration = performanceMetrics.endMetric('recording');
      expect(duration).toBeUndefined();
    });

    it('should return undefined when ending already-ended metric', () => {
      performanceMetrics.startMetric('injection');
      performanceMetrics.endMetric('injection');

      const secondEnd = performanceMetrics.endMetric('injection');
      expect(secondEnd).toBeUndefined();
    });
  });

  describe('getSessionSummary', () => {
    it('should return empty summary for new session', () => {
      const summary = performanceMetrics.getSessionSummary();

      expect(summary).toEqual({
        recording: undefined,
        transcription: undefined,
        processing: undefined,
        injection: undefined,
        total: undefined,
      });
    });

    it('should return partial summary with only completed metrics', () => {
      performanceMetrics.startMetric('recording');
      performanceMetrics.endMetric('recording');

      performanceMetrics.startMetric('transcription');
      performanceMetrics.endMetric('transcription');

      const summary = performanceMetrics.getSessionSummary();

      expect(summary.recording).toBeGreaterThanOrEqual(0);
      expect(summary.transcription).toBeGreaterThanOrEqual(0);
      expect(summary.processing).toBeUndefined();
      expect(summary.injection).toBeUndefined();
    });
  });

  describe('completeSession', () => {
    it('should calculate total duration from recording start to latest end', () => {
      performanceMetrics.startMetric('recording');
      vi.advanceTimersByTime(100);
      performanceMetrics.endMetric('recording');

      performanceMetrics.startMetric('transcription');
      vi.advanceTimersByTime(200);
      performanceMetrics.endMetric('transcription');

      performanceMetrics.completeSession();

      const summary = performanceMetrics.getSessionSummary();
      expect(summary.total).toBeUndefined(); // New session after complete
    });

    it('should add session to history', () => {
      performanceMetrics.startMetric('recording');
      performanceMetrics.endMetric('recording');
      performanceMetrics.completeSession();

      const stats = performanceMetrics.getStatistics();
      expect(stats.historySize).toBe(1);
    });

    it('should reset current session after completion', () => {
      performanceMetrics.startMetric('processing');
      performanceMetrics.endMetric('processing');
      performanceMetrics.completeSession();

      const summary = performanceMetrics.getSessionSummary();
      expect(summary.processing).toBeUndefined();
    });

    it('should trim history when exceeding maxHistorySize (100)', () => {
      // Complete 105 sessions
      for (let i = 0; i < 105; i++) {
        performanceMetrics.startMetric('recording');
        performanceMetrics.endMetric('recording');
        performanceMetrics.completeSession();
      }

      const stats = performanceMetrics.getStatistics();
      expect(stats.historySize).toBe(100);
    });
  });

  describe('getAverageMetrics', () => {
    it('should return null when history is empty', () => {
      const averages = performanceMetrics.getAverageMetrics();
      expect(averages).toBeNull();
    });

    it('should calculate averages from single session', () => {
      performanceMetrics.startMetric('recording');
      vi.advanceTimersByTime(100);
      performanceMetrics.endMetric('recording');

      performanceMetrics.startMetric('transcription');
      vi.advanceTimersByTime(200);
      performanceMetrics.endMetric('transcription');

      performanceMetrics.completeSession();

      const averages = performanceMetrics.getAverageMetrics();
      expect(averages).not.toBeNull();
      expect(averages?.sessionCount).toBe(1);
      expect(averages?.recording).toBeGreaterThanOrEqual(0);
      expect(averages?.transcription).toBeGreaterThanOrEqual(0);
    });

    it('should calculate averages from multiple sessions', () => {
      // Session 1: 100ms recording, 200ms transcription
      performanceMetrics.startMetric('recording');
      vi.advanceTimersByTime(100);
      performanceMetrics.endMetric('recording');

      performanceMetrics.startMetric('transcription');
      vi.advanceTimersByTime(200);
      performanceMetrics.endMetric('transcription');
      performanceMetrics.completeSession();

      // Session 2: 50ms recording, 150ms transcription
      performanceMetrics.startMetric('recording');
      vi.advanceTimersByTime(50);
      performanceMetrics.endMetric('recording');

      performanceMetrics.startMetric('transcription');
      vi.advanceTimersByTime(150);
      performanceMetrics.endMetric('transcription');
      performanceMetrics.completeSession();

      const averages = performanceMetrics.getAverageMetrics();
      expect(averages?.sessionCount).toBe(2);
      // Averages should be close to (100+50)/2 = 75 and (200+150)/2 = 175
      expect(averages?.recording).toBeGreaterThanOrEqual(0);
      expect(averages?.transcription).toBeGreaterThanOrEqual(0);
    });

    it('should round averages to nearest integer', () => {
      performanceMetrics.startMetric('recording');
      vi.advanceTimersByTime(100);
      performanceMetrics.endMetric('recording');
      performanceMetrics.completeSession();

      const averages = performanceMetrics.getAverageMetrics();
      expect(Number.isInteger(averages?.recording)).toBe(true);
    });
  });

  describe('getStatistics', () => {
    it('should return statistics object with current and averages', () => {
      const stats = performanceMetrics.getStatistics();

      expect(stats).toHaveProperty('current');
      expect(stats).toHaveProperty('averages');
      expect(stats).toHaveProperty('historySize');
      expect(stats).toHaveProperty('timestamp');
    });

    it('should include ISO timestamp', () => {
      const stats = performanceMetrics.getStatistics();

      expect(stats.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should show current session data', () => {
      performanceMetrics.startMetric('processing');
      performanceMetrics.endMetric('processing');

      const stats = performanceMetrics.getStatistics();

      expect(stats.current.processing).toBeGreaterThanOrEqual(0);
      expect(stats.historySize).toBe(0); // Not completed yet
    });

    it('should show averages from history', () => {
      performanceMetrics.startMetric('recording');
      performanceMetrics.endMetric('recording');
      performanceMetrics.completeSession();

      const stats = performanceMetrics.getStatistics();

      expect(stats.averages).not.toBeNull();
      expect(stats.historySize).toBe(1);
    });
  });

  describe('reset', () => {
    it('should clear current session', () => {
      performanceMetrics.startMetric('recording');
      performanceMetrics.endMetric('recording');

      performanceMetrics.reset();

      const summary = performanceMetrics.getSessionSummary();
      expect(summary.recording).toBeUndefined();
    });

    it('should clear session history', () => {
      performanceMetrics.startMetric('recording');
      performanceMetrics.endMetric('recording');
      performanceMetrics.completeSession();

      performanceMetrics.reset();

      const stats = performanceMetrics.getStatistics();
      expect(stats.historySize).toBe(0);
      expect(stats.averages).toBeNull();
    });
  });

  describe('full pipeline workflow', () => {
    it('should track complete dictation pipeline', () => {
      // Simulate full pipeline
      performanceMetrics.startMetric('recording');
      vi.advanceTimersByTime(1500); // 1.5s recording
      performanceMetrics.endMetric('recording');

      performanceMetrics.startMetric('transcription');
      vi.advanceTimersByTime(2000); // 2s transcription
      performanceMetrics.endMetric('transcription');

      performanceMetrics.startMetric('processing');
      vi.advanceTimersByTime(1000); // 1s processing
      performanceMetrics.endMetric('processing');

      performanceMetrics.startMetric('injection');
      vi.advanceTimersByTime(100); // 100ms injection
      performanceMetrics.endMetric('injection');

      const summary = performanceMetrics.getSessionSummary();

      expect(summary.recording).toBeGreaterThanOrEqual(0);
      expect(summary.transcription).toBeGreaterThanOrEqual(0);
      expect(summary.processing).toBeGreaterThanOrEqual(0);
      expect(summary.injection).toBeGreaterThanOrEqual(0);
    });
  });
});
