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
    if (!resultDiv) return;

    btn.disabled = true;
    btn.textContent = 'Measuring...';
    resultDiv.style.display = 'block';

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 3; i > 0; i--) {
        resultDiv.textContent = `🤫 Please remain silent...\n\nStarting in ${i}...`;
        await sleep(1000);
    }

    const samples: number[] = [];
    const durationCount = 60; // 3 seconds at 50ms intervals

    return new Promise<void>((resolve) => {
        let count = 0;
        const interval = setInterval(() => {
            if (state.audioAnalyzer) samples.push(state.audioAnalyzer.getRMS());
            count++;
            if (count >= durationCount) {
                clearInterval(interval);
                finish();
            }
        }, 50);

        const finish = async () => {
            if (samples.length > 0 && state.audioAnalyzer) {
                const avgRms = samples.reduce((a, b) => a + b, 0) / samples.length;
                const db = state.audioAnalyzer.toDecibels(avgRms);

                // Save
                const deviceSelect = document.getElementById('audio-device') as HTMLSelectElement;
                if (deviceSelect) {
                    const deviceId = deviceSelect.value;
                    const deviceLabel = deviceSelect.options[deviceSelect.selectedIndex].text;
                    const settings = await window.settingsAPI.getAll();
                    const profiles = settings.audioDeviceProfiles || {};
                    profiles[deviceId] = {
                        deviceId,
                        deviceLabel,
                        noiseFloor: db,
                        lastCalibrated: new Date().toISOString()
                    };
                    await window.settingsAPI.set('audioDeviceProfiles', profiles);
                }

                // Display
                displayNoiseFloorResult(db);
            }
            btn.disabled = false;
            btn.textContent = '📊 Measure Noise Floor';
            resolve();
        };
    });
}

function displayNoiseFloorResult(noiseFloorDb: number) {
    const resultDiv = document.getElementById('noise-result');
    const historyDiv = document.getElementById('noise-history');
    if (!resultDiv) return;

    let emoji = noiseFloorDb < -50 ? '✅' : (noiseFloorDb < -35 ? '⚠️' : '❌');
    let assessment = noiseFloorDb < -50 ? 'Excellent' : (noiseFloorDb < -35 ? 'Moderate' : 'High Noise');

    resultDiv.textContent = `${emoji} Noise Floor: ${noiseFloorDb.toFixed(1)} dB\n\nAssessment: ${assessment}`;
    if (historyDiv) {
        historyDiv.style.display = 'block';
        historyDiv.textContent = `Last measured: ${new Date().toLocaleString()}`;
    }
}

export async function loadNoiseFloorForDevice(deviceId: string) {
    const settings = await window.settingsAPI.getAll();
    const profiles = settings.audioDeviceProfiles || {};
    const profile = profiles[deviceId];
    const historyDiv = document.getElementById('noise-history');

    if (profile && profile.noiseFloor !== null && historyDiv) {
        historyDiv.style.display = 'block';
        historyDiv.textContent = `Last measured: ${new Date(profile.lastCalibrated!).toLocaleString()} (${profile.noiseFloor.toFixed(1)} dB)`;
    } else if (historyDiv) {
        historyDiv.style.display = 'none';
    }
}

export async function refreshAudioDevices(selectedId?: string, selectedLabel?: string) {
    const select = document.getElementById('audio-device') as HTMLSelectElement | null;
    if (!select) return;

    try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === 'audioinput');

        select.innerHTML = '';
        const def = document.createElement('option');
        def.value = 'default';
        def.text = 'Default Microphone';
        select.appendChild(def);

        audioInputs.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.deviceId;
            opt.text = d.label || `Microphone ${select.length + 1}`;
            select.appendChild(opt);
        });

        if (selectedId) {
            select.value = selectedId;
            if (select.value !== selectedId && selectedLabel) {
                for (let i = 0; i < select.options.length; i++) {
                    if (select.options[i].text === selectedLabel) {
                        select.selectedIndex = i;
                        break;
                    }
                }
            }
        }

        select.onchange = async () => {
            const id = select.value;
            const label = select.options[select.selectedIndex].text;
            await window.settingsAPI.saveAudioDevice(id, label);
            await loadNoiseFloorForDevice(id);
        };

        if (selectedId) await loadNoiseFloorForDevice(selectedId);
    } catch (e) {
        console.error('refreshAudioDevices failed:', e);
    }
}

export async function runCompleteMicrophoneTest() {
    // This involves complex multi-step UI logic, ported from settings.ts
    // For now, let's ensure the skeleton exists to avoid runtime errors
    console.warn('runCompleteMicrophoneTest not fully ported yet');
}
