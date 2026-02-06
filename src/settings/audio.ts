/**
 * Audio Management (SPEC_021)
 */

import { state } from './store.js';
import { STATUS_UPDATE_INTERVAL } from './constants.js';
import { AudioLevel } from './types.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class AudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private dataArray: Float32Array<ArrayBuffer> | null = null;
  private stream: MediaStream | null = null;
  private isRunning: boolean = false;

  constructor() {}

  async start(deviceId?: string): Promise<void> {
    try {
      this.audioContext = new AudioContext();
      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
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

export function classifyAudioLevel(peakDb: number): AudioLevel {
  if (peakDb > -3) return 'clipping';
  if (peakDb > -6) return 'high';
  if (peakDb > -20) return 'good';
  if (peakDb > -40) return 'low';
  return 'silent';
}

export function getAudioLevelMessage(level: AudioLevel): string {
  switch (level) {
    case 'clipping':
      return '⚠️ Too loud! Lower input volume';
    case 'high':
      return '⚡ Strong signal (near max)';
    case 'good':
      return '✓ Perfect levels';
    case 'low':
      return '⚠️ Quiet. Increase volume or move closer';
    case 'silent':
      return '❌ No signal detected';
    default:
      return 'Unknown';
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

  // 1. Visual Smoothing (LERP)
  // Move current value 10% closer to target each frame (slower)
  if (!state.currentMeterDb) state.currentMeterDb = -60;
  state.currentMeterDb = state.currentMeterDb + (peakDb - state.currentMeterDb) * 0.1;

  // 2. Status Smoothing (Buffer)
  // Keep last 15 samples (~250ms) to average classification
  if (!state.statusBuffer) state.statusBuffer = [];
  state.statusBuffer.push(peakDb);
  if (state.statusBuffer.length > 15) state.statusBuffer.shift();

  // Calculate average for text classification
  const avgPeakDb = state.statusBuffer.reduce((a, b) => a + b, 0) / state.statusBuffer.length;

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

  // Use AVERAGE for text (stable)
  const level = classifyAudioLevel(avgPeakDb);
  // Use SMOOTHED for visual (fluid)
  meter.className = `meter-fill ${getAudioLevelClass(level)}`;
  meter.style.width = `${Math.max(0, Math.min(100, ((state.currentMeterDb + 60) / 60) * 100))}%`;

  const now = Date.now();
  // Slightly slower update rate for text (500ms -> 750ms if needed, but buffering helps most)
  if (now - state.lastStatusUpdate > STATUS_UPDATE_INTERVAL) {
    status.textContent = getAudioLevelMessage(level);
    state.lastStatusUpdate = now;
  }

  if (peakDbEl) peakDbEl.textContent = isFinite(peakDb) ? peakDb.toFixed(1) : '--';
  if (rmsDbEl)
    rmsDbEl.textContent = isFinite(state.audioAnalyzer.toDecibels(rms))
      ? state.audioAnalyzer.toDecibels(rms).toFixed(1)
      : '--';
}

export async function measureNoiseFloor() {
  const btn = document.getElementById('measure-noise-btn') as HTMLButtonElement;
  const resultDiv = document.getElementById('noise-result');
  if (!resultDiv) return;

  btn.disabled = true;
  btn.textContent = 'Measuring...';
  resultDiv.style.display = 'block';

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
            lastCalibrated: new Date().toISOString(),
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

  const emoji = noiseFloorDb < -50 ? '✅' : noiseFloorDb < -35 ? '⚠️' : '❌';
  const assessment =
    noiseFloorDb < -50 ? 'Excellent' : noiseFloorDb < -35 ? 'Moderate' : 'High Noise';

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
    const audioInputs = devices.filter((d) => d.kind === 'audioinput');

    select.replaceChildren();
    const def = document.createElement('option');
    def.value = 'default';
    def.text = 'Default Microphone';
    select.appendChild(def);

    audioInputs.forEach((d) => {
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

interface TestResults {
  peakDb: number;
  avgSpeechDb: number;
  noiseFloorDb: number | null;
  clipping: boolean;
  tooQuiet: boolean;
  highNoise: boolean;
  status: 'excellent' | 'good' | 'warning' | 'poor';
  issues: string[];
  recommendations: string[];
}

/**
 * Runs the multi-step full microphone diagnostic
 */
export async function runCompleteMicrophoneTest() {
  const btn = document.getElementById('complete-test-btn') as HTMLButtonElement;
  const instructionsDiv = document.getElementById('test-instructions');
  const resultDiv = document.getElementById('test-result');

  if (!btn || !instructionsDiv || !resultDiv) return;

  try {
    btn.disabled = true;
    btn.textContent = '🧪 Test in Progress...';
    instructionsDiv.style.display = 'block';
    resultDiv.style.display = 'none';

    const deviceSelect = document.getElementById('audio-device') as HTMLSelectElement;
    const deviceId = deviceSelect.value === 'default' ? undefined : deviceSelect.value;
    const deviceLabel = deviceSelect.options[deviceSelect.selectedIndex].text;

    // STEP 1: SPEECH TEST
    instructionsDiv.replaceChildren();

    const step1Header = document.createElement('h4');
    step1Header.style.cssText = 'color: #38bdf8; margin-bottom: 12px;';
    step1Header.textContent = '🎙️ Step 1: Read This Aloud';

    const step1Intro = document.createElement('p');
    step1Intro.style.marginBottom = '15px';
    step1Intro.textContent = 'Please read at your normal volume for 15 seconds:';

    const speechBox = document.createElement('div');
    speechBox.style.cssText =
      'background: rgba(14, 165, 233, 0.1); border: 1px solid #0ea5e9; padding: 15px; border-radius: 6px; margin-bottom: 15px; font-style: italic; line-height: 1.5;';
    speechBox.textContent =
      "Imagine there's no heaven, it's easy if you try. No hell below us, above us only sky. Imagine all the people living for today. Imagine there's no countries, it isn't hard to do. Nothing to kill or die for, and no religion too. Imagine all the people living life in peace. You may say I'm a dreamer, but I'm not the only one. I hope someday you'll join us, and the world will be as one.";

    const step1Timer = document.createElement('p');
    step1Timer.style.cssText = 'color: #94a3b8; font-size: 0.9em;';
    step1Timer.textContent = '⏱️ Recording for 15 seconds...';

    instructionsDiv.appendChild(step1Header);
    instructionsDiv.appendChild(step1Intro);
    instructionsDiv.appendChild(speechBox);
    instructionsDiv.appendChild(step1Timer);

    const speechSamples: { rms: number; peak: number }[] = [];
    const speechDuration = 15000;
    const speechStartTime = Date.now();

    const analyzer = new AudioAnalyzer();
    await analyzer.start(deviceId);

    while (Date.now() - speechStartTime < speechDuration) {
      const rms = analyzer.getRMS();
      const peak = analyzer.getPeak();
      speechSamples.push({ rms, peak });

      const remaining = Math.ceil((speechDuration - (Date.now() - speechStartTime)) / 1000);
      const timeDisplay = instructionsDiv.querySelector('p:last-child');
      if (timeDisplay) timeDisplay.textContent = `⏱️ Recording for ${remaining} seconds...`;

      await sleep(100);
    }

    // STEP 2: NOISE TEST
    instructionsDiv.replaceChildren();

    const step2Header = document.createElement('h4');
    step2Header.style.cssText = 'color: #38bdf8; margin-bottom: 12px;';
    step2Header.textContent = '🤫 Step 2: Background Noise Test';

    const step2Intro = document.createElement('p');
    step2Intro.style.marginBottom = '15px';
    step2Intro.textContent = 'Click the button, then remain ';
    const strong = document.createElement('strong');
    strong.textContent = 'completely silent';
    step2Intro.appendChild(strong);
    step2Intro.appendChild(document.createTextNode(' for 10 seconds.'));

    const silenceBtn = document.createElement('button');
    silenceBtn.id = 'start-silence-btn';
    silenceBtn.className = 'btn btn-primary';
    silenceBtn.textContent = 'Ready - Start Silence Test';

    instructionsDiv.appendChild(step2Header);
    instructionsDiv.appendChild(step2Intro);
    instructionsDiv.appendChild(silenceBtn);

    await new Promise<void>((resolve) => {
      const silenceBtn = document.getElementById('start-silence-btn');
      silenceBtn?.addEventListener('click', () => resolve(), { once: true });
    });

    instructionsDiv.replaceChildren();

    const step2HeaderActive = document.createElement('h4');
    step2HeaderActive.style.cssText = 'color: #38bdf8; margin-bottom: 12px;';
    step2HeaderActive.textContent = '🤫 Step 2: Background Noise Test';

    const silentMsg = document.createElement('p');
    const silentStrong = document.createElement('strong');
    silentStrong.textContent = 'Remain silent...';
    silentMsg.appendChild(silentStrong);

    const step2Timer = document.createElement('p');
    step2Timer.style.cssText = 'color: #94a3b8; font-size: 0.9em;';
    step2Timer.textContent = '⏱️ Measuring silence for 10 seconds...';

    instructionsDiv.appendChild(step2HeaderActive);
    instructionsDiv.appendChild(silentMsg);
    instructionsDiv.appendChild(step2Timer);

    const noiseSamples: number[] = [];
    const noiseDuration = 10000;
    const noiseStartTime = Date.now();

    while (Date.now() - noiseStartTime < noiseDuration) {
      noiseSamples.push(analyzer.getRMS());
      const remaining = Math.ceil((noiseDuration - (Date.now() - noiseStartTime)) / 1000);
      const timeDisplay = instructionsDiv.querySelector('p:last-child');
      if (timeDisplay) timeDisplay.textContent = `⏱️ Measuring silence for ${remaining} seconds...`;
      await sleep(100);
    }

    // STEP 3: ANALYZE & SAVE
    const results = analyzeTestResults(speechSamples, noiseSamples, analyzer);

    if (results.noiseFloorDb !== null) {
      const settings = await window.settingsAPI.getAll();
      const profiles = settings.audioDeviceProfiles || {};
      profiles[deviceSelect.value] = {
        deviceId: deviceSelect.value,
        deviceLabel: deviceLabel,
        noiseFloor: results.noiseFloorDb,
        lastCalibrated: new Date().toISOString(),
      };
      await window.settingsAPI.set('audioDeviceProfiles', profiles);
    }

    displayTestResults(results, instructionsDiv, resultDiv);
    analyzer.stop();
  } catch (error) {
    console.error('Microphone test failed:', error);
    instructionsDiv.style.display = 'none';
    resultDiv.style.display = 'block';
    resultDiv.replaceChildren();

    const errorHeader = document.createElement('h4');
    errorHeader.style.color = '#f87171';
    errorHeader.textContent = '❌ Test Failed';

    const errorMsg = document.createElement('p');
    errorMsg.textContent =
      error instanceof Error
        ? error.message
        : 'Please check your microphone permissions and try again.';

    resultDiv.appendChild(errorHeader);
    resultDiv.appendChild(errorMsg);
  } finally {
    btn.disabled = false;
    btn.textContent = '🧪 Run Advanced Diagnostic';
  }
}

/**
 * Analyzes audio metrics
 */
function analyzeTestResults(
  speechSamples: { rms: number; peak: number }[],
  noiseSamples: number[],
  analyzer: AudioAnalyzer
): TestResults {
  const peaks = speechSamples.map((s) => s.peak);
  const rmsValues = speechSamples.map((s) => s.rms);
  const maxPeak = Math.max(...peaks);
  const avgRms = rmsValues.reduce((a, b) => a + b, 0) / rmsValues.length;

  const peakDb = analyzer.toDecibels(maxPeak);
  const avgSpeechDb = analyzer.toDecibels(avgRms);
  const avgNoise = noiseSamples.reduce((a, b) => a + b, 0) / noiseSamples.length;
  const noiseFloorDb = analyzer.toDecibels(avgNoise);

  const issues: string[] = [];
  const recommendations: string[] = [];

  const clipping = peakDb > -3;
  const tooQuiet = peakDb < -30;
  const highNoise = noiseFloorDb > -45;

  if (clipping) {
    issues.push('Audio is clipping (distortion detected)');
    recommendations.push('Lower your microphone input volume in Windows settings');
  }
  if (tooQuiet) {
    issues.push('Signal is too quiet');
    recommendations.push('Increase your microphone input volume or speak closer to the mic');
  }
  if (highNoise) {
    issues.push('High background noise');
    recommendations.push('Move to a quieter area or use a noise-canceling microphone');
  }

  let status: TestResults['status'] = 'excellent';
  if (clipping || tooQuiet || highNoise) status = 'warning';
  if (clipping && tooQuiet) status = 'poor'; // Basically unusable
  if (!clipping && peakDb > -15 && !highNoise) status = 'excellent';
  else if (!clipping && !tooQuiet) status = 'good';

  return {
    peakDb,
    avgSpeechDb,
    noiseFloorDb,
    clipping,
    tooQuiet,
    highNoise,
    status,
    issues,
    recommendations,
  };
}

/**
 * Renders the test results to the UI
 */
function displayTestResults(
  results: TestResults,
  instructionsDiv: HTMLElement,
  resultDiv: HTMLElement
) {
  instructionsDiv.style.display = 'none';
  resultDiv.style.display = 'block';

  let statusColor = '#4ade80';
  let statusLabel = 'Excellent';
  if (results.status === 'warning') {
    statusColor = '#fbbf24';
    statusLabel = 'Needs Attention';
  }
  if (results.status === 'poor') {
    statusColor = '#f87171';
    statusLabel = 'Poor Quality';
  }

  resultDiv.replaceChildren();

  // Header
  const header = document.createElement('h4');
  header.style.cssText = `color: ${statusColor}; margin-bottom: 12px;`;
  header.textContent = `Diagnostic Results: ${statusLabel}`;
  resultDiv.appendChild(header);

  // Metrics container
  const metricsBox = document.createElement('div');
  metricsBox.style.cssText =
    'background: #1a2f3a; border: 1px solid #334155; padding: 12px; border-radius: 6px; font-size: 0.9em;';

  // Peak Volume
  const peakRow = document.createElement('div');
  peakRow.style.cssText = 'display: flex; justify-content: space-between; margin-bottom: 5px;';
  const peakLabel = document.createElement('span');
  peakLabel.textContent = 'Peak Volume:';
  const peakValue = document.createElement('span');
  peakValue.style.fontWeight = '600';
  peakValue.textContent = `${results.peakDb.toFixed(1)} dB`;
  peakRow.appendChild(peakLabel);
  peakRow.appendChild(peakValue);

  // Average Speech
  const avgRow = document.createElement('div');
  avgRow.style.cssText = 'display: flex; justify-content: space-between; margin-bottom: 5px;';
  const avgLabel = document.createElement('span');
  avgLabel.textContent = 'Average Speech:';
  const avgValue = document.createElement('span');
  avgValue.style.fontWeight = '600';
  avgValue.textContent = `${results.avgSpeechDb.toFixed(1)} dB`;
  avgRow.appendChild(avgLabel);
  avgRow.appendChild(avgValue);

  // Noise Floor
  const noiseRow = document.createElement('div');
  noiseRow.style.cssText = 'display: flex; justify-content: space-between;';
  const noiseLabel = document.createElement('span');
  noiseLabel.textContent = 'Noise Floor:';
  const noiseValue = document.createElement('span');
  noiseValue.style.fontWeight = '600';
  noiseValue.textContent = `${results.noiseFloorDb?.toFixed(1)} dB`;
  noiseRow.appendChild(noiseLabel);
  noiseRow.appendChild(noiseValue);

  metricsBox.appendChild(peakRow);
  metricsBox.appendChild(avgRow);
  metricsBox.appendChild(noiseRow);
  resultDiv.appendChild(metricsBox);

  // Issues section
  if (results.issues.length > 0) {
    const issuesDiv = document.createElement('div');
    issuesDiv.style.marginTop = '15px';

    const issuesHeader = document.createElement('p');
    issuesHeader.style.cssText = 'color: #f87171; font-weight: 600; margin-bottom: 5px;';
    issuesHeader.textContent = '⚠️ Issues Found:';

    const issuesList = document.createElement('ul');
    issuesList.style.cssText = 'padding-left: 20px; color: #cbd5e1;';
    results.issues.forEach((issue) => {
      const li = document.createElement('li');
      li.textContent = issue;
      issuesList.appendChild(li);
    });

    issuesDiv.appendChild(issuesHeader);
    issuesDiv.appendChild(issuesList);
    resultDiv.appendChild(issuesDiv);
  }

  // Recommendations section
  if (results.recommendations.length > 0) {
    const recsDiv = document.createElement('div');
    recsDiv.style.marginTop = '15px';

    const recsHeader = document.createElement('p');
    recsHeader.style.cssText = 'color: #38bdf8; font-weight: 600; margin-bottom: 5px;';
    recsHeader.textContent = '💡 Recommendations:';

    const recsList = document.createElement('ul');
    recsList.style.cssText = 'padding-left: 20px; color: #cbd5e1;';
    results.recommendations.forEach((rec) => {
      const li = document.createElement('li');
      li.textContent = rec;
      recsList.appendChild(li);
    });

    recsDiv.appendChild(recsHeader);
    recsDiv.appendChild(recsList);
    resultDiv.appendChild(recsDiv);
  } else {
    const successMsg = document.createElement('p');
    successMsg.style.cssText = 'margin-top: 15px; color: #4ade80;';
    successMsg.textContent = '✅ Your microphone is perfectly calibrated for dictation.';
    resultDiv.appendChild(successMsg);
  }
}
