/**
 * Audio Analyzer (SPEC_021)
 */

import { AudioLevel } from './types';

export class AudioAnalyzer {
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private microphone: MediaStreamAudioSourceNode | null = null;
    private dataArray: Float32Array<ArrayBuffer> | null = null;
    private stream: MediaStream | null = null;
    private isRunning: boolean = false;

    constructor() { }

    async start(deviceId?: string): Promise<void> {
        try {
            this.audioContext = new AudioContext();
            const constraints: MediaStreamConstraints = {
                audio: deviceId ? { deviceId: { exact: deviceId } } : true
            };
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.3;
            this.microphone = this.audioContext.createMediaStreamSource(this.stream);
            this.microphone.connect(this.analyser);
            this.dataArray = new Float32Array(this.analyser.fftSize);
            this.isRunning = true;
        } catch (error) {
            this.cleanup();
            throw new Error(`Failed to start audio analyzer: ${error}`);
        }
    }

    stop(): void {
        this.cleanup();
    }

    getRMS(): number {
        if (!this.analyser || !this.dataArray || !this.isRunning) return 0;
        this.analyser.getFloatTimeDomainData(this.dataArray);
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i] * this.dataArray[i];
        }
        return Math.sqrt(sum / this.dataArray.length);
    }

    getPeak(): number {
        if (!this.analyser || !this.dataArray || !this.isRunning) return 0;
        this.analyser.getFloatTimeDomainData(this.dataArray);
        let peak = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            const abs = Math.abs(this.dataArray[i]);
            if (abs > peak) peak = abs;
        }
        return peak;
    }

    toDecibels(amplitude: number): number {
        if (amplitude <= 0) return -Infinity;
        return 20 * Math.log10(amplitude);
    }

    private cleanup(): void {
        this.isRunning = false;
        if (this.microphone) {
            this.microphone.disconnect();
            this.microphone = null;
        }
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
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

export function classifyAudioLevel(peakDb: number): AudioLevel {
    if (peakDb > -3) return 'clipping';
    if (peakDb > -6) return 'high';
    if (peakDb > -20) return 'good';
    if (peakDb > -40) return 'low';
    return 'silent';
}

export function getAudioLevelMessage(level: AudioLevel): string {
    switch (level) {
        case 'clipping': return '⚠️ Too loud! Lower input volume';
        case 'high': return '⚡ Strong signal (near max)';
        case 'good': return '✓ Perfect levels';
        case 'low': return '⚠️ Quiet. Increase volume or move closer';
        case 'silent': return '❌ No signal detected';
        default: return 'Unknown';
    }
}

export function getAudioLevelClass(level: AudioLevel): string {
    return `level-${level}`;
}
