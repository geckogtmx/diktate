/**
 * Performance metrics tracker
 * Tracks timing and performance data for the dictation pipeline
 */

import { logger } from './logger';

interface MetricData {
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

interface PipelineMetrics {
  recording?: MetricData;
  transcription?: MetricData;
  processing?: MetricData;
  injection?: MetricData;
  total?: MetricData;
}

interface SessionSummary {
  recording?: number;
  transcription?: number;
  processing?: number;
  injection?: number;
  total?: number;
}

interface AverageMetrics {
  recording: number;
  transcription: number;
  processing: number;
  injection: number;
  total: number;
  sessionCount: number;
}

interface Statistics {
  current: SessionSummary;
  averages: AverageMetrics | null;
  historySize: number;
  timestamp: string;
}

class PerformanceMetrics {
  private currentSession: PipelineMetrics = {};
  private sessionHistory: PipelineMetrics[] = [];
  private maxHistorySize: number = 100;

  /**
   * Start timing a metric
   */
  startMetric(metricName: keyof PipelineMetrics, metadata?: Record<string, unknown>): void {
    this.currentSession[metricName] = {
      startTime: Date.now(),
      metadata,
    };
    logger.debug('Metrics', `Started ${metricName} metric`, metadata);
  }

  /**
   * End timing a metric
   */
  endMetric(
    metricName: keyof PipelineMetrics,
    metadata?: Record<string, unknown>
  ): number | undefined {
    const metric = this.currentSession[metricName];
    if (!metric || metric.endTime) {
      logger.warn(
        'Metrics',
        `Attempted to end non-existent or already-ended metric: ${metricName}`
      );
      return undefined;
    }

    metric.endTime = Date.now();
    metric.duration = metric.endTime - metric.startTime;

    if (metadata) {
      metric.metadata = { ...metric.metadata, ...metadata };
    }

    logger.info('Metrics', `Completed ${metricName}`, {
      duration: metric.duration,
      ...metric.metadata,
    });

    return metric.duration;
  }

  /**
   * Complete the current session and save to history
   */
  completeSession(): void {
    // Calculate total duration if we have start times
    if (this.currentSession.recording?.startTime) {
      const latestEndTime = Math.max(
        this.currentSession.recording?.endTime || 0,
        this.currentSession.transcription?.endTime || 0,
        this.currentSession.processing?.endTime || 0,
        this.currentSession.injection?.endTime || 0
      );

      if (latestEndTime > 0) {
        this.currentSession.total = {
          startTime: this.currentSession.recording.startTime,
          endTime: latestEndTime,
          duration: latestEndTime - this.currentSession.recording.startTime,
        };
      }
    }

    // Log complete session metrics
    const summary = this.getSessionSummary();
    logger.info('Metrics', 'Session completed', { ...summary });

    // Save to history
    this.sessionHistory.push({ ...this.currentSession });

    // Trim history if needed
    if (this.sessionHistory.length > this.maxHistorySize) {
      this.sessionHistory.shift();
    }

    // Reset current session
    this.currentSession = {};
  }

  /**
   * Get summary of current session
   */
  getSessionSummary(): SessionSummary {
    return {
      recording: this.currentSession.recording?.duration,
      transcription: this.currentSession.transcription?.duration,
      processing: this.currentSession.processing?.duration,
      injection: this.currentSession.injection?.duration,
      total: this.currentSession.total?.duration,
    };
  }

  /**
   * Get average metrics from history
   */
  getAverageMetrics(): AverageMetrics | null {
    if (this.sessionHistory.length === 0) {
      return null;
    }

    const totals = {
      recording: 0,
      transcription: 0,
      processing: 0,
      injection: 0,
      total: 0,
      count: this.sessionHistory.length,
    };

    for (const session of this.sessionHistory) {
      totals.recording += session.recording?.duration || 0;
      totals.transcription += session.transcription?.duration || 0;
      totals.processing += session.processing?.duration || 0;
      totals.injection += session.injection?.duration || 0;
      totals.total += session.total?.duration || 0;
    }

    return {
      recording: Math.round(totals.recording / totals.count),
      transcription: Math.round(totals.transcription / totals.count),
      processing: Math.round(totals.processing / totals.count),
      injection: Math.round(totals.injection / totals.count),
      total: Math.round(totals.total / totals.count),
      sessionCount: totals.count,
    };
  }

  /**
   * Get performance statistics
   */
  getStatistics(): Statistics {
    const averages = this.getAverageMetrics();
    const current = this.getSessionSummary();

    return {
      current,
      averages,
      historySize: this.sessionHistory.length,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.currentSession = {};
    this.sessionHistory = [];
    logger.info('Metrics', 'Performance metrics reset');
  }
}

// Export singleton instance
export const performanceMetrics = new PerformanceMetrics();
