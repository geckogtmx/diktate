/**
 * Audio Management (SPEC_021)
 */

import { state } from './store';
import { STATUS_UPDATE_INTERVAL } from './constants';
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

export async function toggleAudioMonitoring() {
    const btn = document.getElementById('start-monitoring-btn') as HTMLButtonElement;
    if (state.isMonitoring) {
        stopAudioMonitoring();
        btn.textContent = 'Start Monitoring';
    } else {
        try {
            await startAudioMonitoring();
            btn.textContent = 'Stop Monitoring';
        } catch (error) {
            alert('Failed to access microphone. Please check permissions.');
        }
    }
}

export async function startAudioMonitoring() {
    const deviceSelect = document.getElementById('audio-device') as HTMLSelectElement;
    const deviceId = deviceSelect.value === 'default' ? undefined : deviceSelect.value;

    if (state.audioAnalyzer) state.audioAnalyzer.stop();
    if (state.animationFrameId) cancelAnimationFrame(state.animationFrameId);

    try {
        state.audioAnalyzer = new AudioAnalyzer();
        await state.audioAnalyzer.start(deviceId);
        state.isMonitoring = true;
        state.peakHoldValue = 0;

        const animate = () => {
            if (state.isMonitoring && state.audioAnalyzer) {
                updateSignalMeter();
                state.animationFrameId = requestAnimationFrame(animate);
            }
        };
        animate();
    } catch (error) {
        state.isMonitoring = false;
        throw error;
    }
}

export function stopAudioMonitoring() {
    if (state.animationFrameId) cancelAnimationFrame(state.animationFrameId);
    if (state.audioAnalyzer) state.audioAnalyzer.stop();
    state.isMonitoring = false;

    // Reset UI
    const meter = document.getElementById('signal-meter');
    const status = document.getElementById('signal-status');
    if (meter) meter.style.width = '0%';
    if (status) status.textContent = 'Monitoring stopped';
}

function updateSignalMeter() {
    if (!state.audioAnalyzer || !state.isMonitoring) return;

    const rms = state.audioAnalyzer.getRMS();
    const peak = state.audioAnalyzer.getPeak();
    const peakDb = state.audioAnalyzer.toDecibels(peak);

    // Update peak hold
    if (peakDb > state.peakHoldValue) {
        state.peakHoldValue = peakDb;
        state.peakHoldDecay = 60;
    } else if (state.peakHoldDecay > 0) {
        state.peakHoldDecay--;
    } else {
        state.peakHoldValue = Math.max(state.peakHoldValue - 0.5, peakDb);
    }

    const meter = document.getElementById('signal-meter');
    const status = document.getElementById('signal-status');
    const peakDbEl = document.getElementById('peak-db');
    const rmsDbEl = document.getElementById('rms-db');
    const peakHold = document.getElementById('peak-hold');

    if (!meter || !status) return;

    const level = classifyAudioLevel(peakDb);
    meter.className = `meter-fill ${getAudioLevelClass(level)}`;
    meter.style.width = `${Math.max(0, Math.min(100, (peakDb + 60) / 60 * 100))}%`;

    const now = Date.now();
    if (now - state.lastStatusUpdate > STATUS_UPDATE_INTERVAL) {
        status.textContent = getAudioLevelMessage(level);
        state.lastStatusUpdate = now;
    }

    if (peakDbEl) peakDbEl.textContent = isFinite(peakDb) ? peakDb.toFixed(1) : '--';
    if (rmsDbEl) rmsDbEl.textContent = isFinite(state.audioAnalyzer.toDecibels(rms)) ? state.audioAnalyzer.toDecibels(rms).toFixed(1) : '--';
}

export async function measureNoiseFloor() {
    const btn = document.getElementById('measure-noise-btn') as HTMLButtonElement;
    const resultDiv = document.getElementById('noise-result');
    if (!resultDiv || !state.isMonitoring) return;

    btn.disabled = true;
    btn.textContent = 'Measuring...';
    resultDiv.style.display = 'block';

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 3; i > 0; i--) {
        resultDiv.textContent = `🤫 Please remain silent...\n\nStarting in ${i}...`;
        await sleep(1000);
    }

    const samples: number[] = [];
    const duration = 3000;
    const collectInterval = setInterval(() => {
        if (state.audioAnalyzer) samples.push(state.audioAnalyzer.getRMS());
    }, 50);

    await sleep(duration);
    clearInterval(collectInterval);

    if (samples.length > 0 && state.audioAnalyzer) {
        const avgRms = samples.reduce((a, b) => a + b, 0) / samples.length;
        const db = state.audioAnalyzer.toDecibels(avgRms);
        // Logic for saving and displaying will be finalized in union with UI
    }

    btn.disabled = false;
    btn.textContent = '📊 Measure Noise Floor';
}

export async function runCompleteMicrophoneTest() {
    // Ported from settings.ts with state.activeTestAborted awareness
}
