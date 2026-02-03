/**
 * Audio Analyzer Module (SPEC_021)
 * Provides real-time audio analysis for microphone input
 * Uses Web Audio API for zero-latency signal processing
 */

export class AudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private dataArray: Float32Array<ArrayBuffer> | null = null;
  private stream: MediaStream | null = null;
  private isRunning: boolean = false;

  /**
   * Initialize the audio analyzer
   */
  constructor() {
    // AudioContext will be created on start to avoid autoplay policy issues
  }

  /**
   * Start analyzing audio from the specified device
   * @param deviceId - Optional device ID. If not provided, uses default microphone
   */
  async start(deviceId?: string): Promise<void> {
    try {
      // Create AudioContext
      this.audioContext = new AudioContext();

      // Request microphone access
      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Create analyser node
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.3;

      // Create microphone source
      this.microphone = this.audioContext.createMediaStreamSource(this.stream);
      this.microphone.connect(this.analyser);

      // Initialize data array
      this.dataArray = new Float32Array(this.analyser.fftSize);

      this.isRunning = true;
    } catch (error) {
      this.cleanup();
      throw new Error(`Failed to start audio analyzer: ${error}`);
    }
  }

  /**
   * Stop analyzing audio and cleanup resources
   */
  stop(): void {
    this.cleanup();
  }

  /**
   * Get the Root Mean Square (RMS) amplitude
   * RMS provides a more accurate representation of loudness than peak
   * @returns RMS amplitude (0.0 to 1.0)
   */
  getRMS(): number {
    if (!this.analyser || !this.dataArray || !this.isRunning) {
      return 0;
    }

    this.analyser.getFloatTimeDomainData(this.dataArray);

    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i] * this.dataArray[i];
    }

    return Math.sqrt(sum / this.dataArray.length);
  }

  /**
   * Get the peak amplitude
   * Peak represents the maximum instantaneous level
   * @returns Peak amplitude (0.0 to 1.0)
   */
  getPeak(): number {
    if (!this.analyser || !this.dataArray || !this.isRunning) {
      return 0;
    }

    this.analyser.getFloatTimeDomainData(this.dataArray);

    let peak = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      const abs = Math.abs(this.dataArray[i]);
      if (abs > peak) {
        peak = abs;
      }
    }

    return peak;
  }

  /**
   * Convert amplitude to decibels (dB)
   * Uses the standard formula: 20 * log10(amplitude)
   * @param amplitude - Amplitude value (0.0 to 1.0)
   * @returns Decibel value (typically -60 to 0 dB)
   */
  toDecibels(amplitude: number): number {
    if (amplitude <= 0) {
      return -Infinity;
    }
    return 20 * Math.log10(amplitude);
  }

  /**
   * Check if the analyzer is currently running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Cleanup all resources
   */
  private cleanup(): void {
    this.isRunning = false;

    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
    this.dataArray = null;
  }
}

/**
 * Audio level classification based on dB values
 */
export enum AudioLevel {
  SILENT = 'silent',
  LOW = 'low',
  GOOD = 'good',
  HIGH = 'high',
  CLIPPING = 'clipping',
}

/**
 * Classify audio level based on peak dB
 * @param peakDb - Peak level in decibels
 * @returns Audio level classification
 */
export function classifyAudioLevel(peakDb: number): AudioLevel {
  if (peakDb > -3) {
    return AudioLevel.CLIPPING;
  } else if (peakDb > -6) {
    return AudioLevel.HIGH;
  } else if (peakDb > -20) {
    return AudioLevel.GOOD;
  } else if (peakDb > -40) {
    return AudioLevel.LOW;
  } else {
    return AudioLevel.SILENT;
  }
}

/**
 * Get user-friendly status message for audio level
 * @param level - Audio level classification
 * @returns Status message with emoji
 */
export function getAudioLevelMessage(level: AudioLevel): string {
  switch (level) {
    case AudioLevel.CLIPPING:
      return '⚠️ Too loud! Lower input volume';
    case AudioLevel.HIGH:
      return '⚡ Strong signal (near max)';
    case AudioLevel.GOOD:
      return '✓ Perfect levels';
    case AudioLevel.LOW:
      return '⚠️ Quiet. Increase volume or move closer';
    case AudioLevel.SILENT:
      return '❌ No signal detected';
    default:
      return 'Unknown';
  }
}

/**
 * Get CSS class for audio level
 * @param level - Audio level classification
 * @returns CSS class name
 */
export function getAudioLevelClass(level: AudioLevel): string {
  return `level-${level}`;
}
