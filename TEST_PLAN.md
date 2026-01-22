# dIKtate Gemma3:4b Endurance & Hallucination Stress Test Plan

Author: Your name
Date: 2026-01-21
Scope: Long-running, mixed-input stress tests of Gemma3:4b with video-derived audio, TTS variations, and endurance measurements to quantify latency, accuracy, drift, and stability.

---

## 1) Goals & Scope

- Goal: Run long, mixed-input sessions that repeatedly feed Gemma3:4b, with video-derived audio chunks and optional TTS variants, to stress-test latency, drift, and hallucination resistance.
- Endurance targets: start with 60–120 minutes, scale to 2–4 hours, then longer if hardware allows.
- Metrics to collect:
  - Latency: recording, transcription, cleaning, injection, total per cycle
  - Accuracy: transcription accuracy (ground-truth available), cleaning coherence
  - Hallucination signals: drift in meaning, coherence across rounds, meta-reference stability
  - Resource usage: CPU/GPU, memory, I/O throughput
  - Stability: crashes, leaks, restartability
- Inputs: 20–30 phrases, each with 3–5 variants (tone, cadence, speed); optional video-derived audio; optional TTS variants
- Outputs: per-fragment results (JSON/CSV), comprehensive logs, optional drift/coherence reports

---

## 2) Test Matrix (Plan to Execute)

- Phrase pool: 20–30 items that cover declaratives, numbers/dates, questions, commands, and tech terms (GPU, latency, Whisper, Gemma).
- Variants per phrase (3–5 total):
  - Tone: neutral, friendly, authoritative, excited
  - Cadence: slow, normal, fast
  - Speed tweaks (optional): -10%, +10%
- Curve variants (optional): deliberate pauses, elongated vowels, or stressed syllables
- Input paths:
  - Manual: dictate phrases with a mic
  - Automated: Windows TTS voices (multiple voices)
- Run configuration:
  - Batch size: balanced to keep memory within limits
  - Order: randomized order per run
  - Duration: 60–120 minutes baseline; extend to 240 minutes or more for endurance

---

## 3) Data Model & Artifacts

- Per variant fragment:
  - fragment_id, phrase_id, variant_id
  - description (tone, cadence, speed)
  - duration (seconds)
  - audio_path
  - transcription_text
  - transcription_time (ms)
  - cleaned_text
  - processing_time (ms)
  - injected_text (optional)
  - total_time (ms)
  - transcription_accuracy (if ground truth exists)
  - cleaning_coherence_score (0–10; optional)
  - drift_score (0–100 scale; optional)
  - redaction_status (yes/no, with details)
- Session artifacts:
  - session_id
  - start_time, end_time
  - environment notes (mic model, room conditions)
  - hardware profile (CPU, GPU, RAM)
- Outputs:
  - JSON results per fragment
  - CSV summary
  - Optional drift/coherence reports
- Logs:
  - Full verbose logs with redacted content where needed

---

## 4) Video & Audio Ingestion (Video-Derived Audio)

- Source: ingest video files (local or streaming) with slow dialog and pauses.
- Extraction plan:
  - Use a deterministic script to extract audio segments at precise start/stop times
  - Insert fixed pauses by injecting silence segments at predetermined intervals
  - Ensure audio chunks are 16-bit PCM WAV, 44.1 kHz (or consistent sample rate)
- Playback strategy:
  - Randomize the order of generated audio chunks for stress on buffering and sequencing
  - For video, leave the video playing in background if needed, but feed only audio chunks to the pipeline (or route via a virtual audio device if you want end-to-end realism)

---

## 5) Input Paths

- Manual Dictation:
  - You dictate phrases into a mic
  - Variants applied by you (tone, cadence, speed)
- Automated DT (TTS):
  - Windows TTS voices (different voices for different tones)
  - Generate audio variants per phrase
  - Save WAVs for transcription

---

## 6) End-to-End Pipeline

1) Ingest audio
   - Source: manual recording or TTS-generated audio
2) Transcription
   - Whisper-based transcription (faster-whisper or chosen model)
   - Capture transcription_text and transcription_time
3) Cleaning
   - Gemma3:4b with mode prompts (standard, gemma-standard override)
   - Capture cleaned_text and processing_time
4) Output/injection
   - Optional: injection into a test app or clipboard
   - Record injection time and success
5) Logging
   - Persist per-variant results to JSON/CSV
   - Redact sensitive text as configured
6) Loop control
   - Shuffle variants, respect duration targets
   - If end-of-session, optionally restart or advance to next endurance tier
7) Optional meta test
   - Feed cleaned_text as next prompt to stress coherence and self-reference

---

## 7) Hallucination Resistance: How to Measure

- Drift metric:
  - Define semantic drift as divergence between intended meaning and final processed text over time
  - Use lexical overlap and optional semantic similarity (if you have a baseline)
- Coherence:
  - Track whether outputs stay on topic across rounds or progressively diverge
- Stability:
  - Monitor log cadence, model responses, and repeating patterns that indicate drift or memory buildup
- Thresholds to consider:
  - Drift should remain within a predefined percentile per hour
  - Latency should remain under your target (adjust per hardware)
  - Coherence score should stay above a threshold (e.g., 7–9 / 10)

---

## 8) Data Collection & Analysis Plan

- Per-run analytics:
  - Averages, percentiles (p50, p90, p95) for latency
  - Transcription accuracy and cleaning coherence averages per variant
  - Drift and coherence indicators per hour
- Post-run analytics:
  - Compare endurance session results vs. baseline
  - Identify bottlenecks (Whisper time, Gemma processing time)
  - Cross-compare TTS variants vs. manual dictation
- Optional advanced analysis:
  - Push results to Gemini/Anthropic for semantic drift analysis, topic modeling, anomaly detection
  - Build dashboards or flat reports for sprint reviews

---

## 9) Runbook: Short Run (60–120 minutes)

- Step 1: Prepare
  - Assemble 20–30 phrases
  - Define 3 variants per phrase (tone, cadence, speed)
  - Prepare video-derived audio segments (and optional TTS voices)
  - Ensure logs directory exists: C:\Users\<you>\.diktate\logs
- Step 2: Execute
  - Start automated mode with video-derived audio (60–120 minutes)
  - Randomize sequence of phrase variants
  - Capture per-fragment outputs, timings, and redacted text
- Step 3: Monitor
  - Watch resource usage (CPU/GPU/memory)
  - Ensure no leaks; watch for long-running processes
- Step 4: Analyze
  - Collect results.json and summary.csv
  - Compute drift and coherence metrics
  - Review any anomalies or spikes
- Step 5: Optimize
  - Based on bottlenecks, adjust Whisper model, Gemma prompts, chunk sizes
  - Consider streaming/transcription tuning and parallelization
- Step 6: Repeat
  - Run longer endurance (2–4 hours) with additional variations
  - Introduce meta/self-referential rounds if desired

---

## 10) Endurance Targets & Scaling

- Tier 1: 60–120 minutes (baseline)
- Tier 2: 120–240 minutes (mixed inputs)
- Tier 3: 4+ hours (extreme endurance; automated path dominant)
- For longer runs:
  - Implement periodic resets (soft restarts) to avoid memory leaks
  - Use log rotation and archiving to keep disk usage predictable
  - Rate-limit per-hour transcripts to avoid runaway system load
  - Introduce auto-health checks and automatic recovery

---

## 11) Deliverables

- Results JSON per run with the per-fragment data
- CSV summaries with metrics by variant and by hour
- Drift and coherence reports (text or JSON)
- Optional: meta-conversation transcript (txt)
- Dashboards (optional, later)

---

## 12) Risks & Mitigations

- Hardware saturation
  - Mitigation: run in batches, rotate tasks, enable log rotation
- Memory leaks or crashes
  - Mitigation: watchdog and automatic restart, isolate runs in separate processes
- Inconsistent audio quality
  - Mitigation: fix sample rate and bit depth, use controlled TTS variants where possible
- Data privacy
  - Mitigation: local-only processing; redact logs; consider discarding audio after processing
- Cloud analysis (Gemini/Anthropic)
  - Mitigation: ensure explicit consent and data-retention policies; anonymize data where possible

---

## 13) Prerequisites & Tooling (Checklist)

- Audio: WAV, 44.1 kHz, 16-bit (manual and automated variants)
- Whisper (faster-whisper) installed and configured
- Gemma3:4b prompts configured (prompts.py or equivalent)
- Video-to-audio tooling (FFmpeg or equivalent) if deriving audio from video
- TTS voices available on Windows (SAPI/Edge/others) for automated variants
- Logging path: C:\Users\<you>\.diktate\logs
- Access to Gemini/Anthropic (optional) for advanced analysis

---

## 14) Next Steps

- Decide on endurance targets (60, 120, 240 minutes) and the initial phrase/variant count
- Provide or confirm:
  - Phrase pool (20–30 phrases)
  - Variant definitions (tone, cadence, speed)
  - Video sources and allowed TTS voices
- If you want, I'll produce:
  - A concrete 60-minute 3-variant plan with a ready-to-run runbook
  - A sample JSON schema for results
  - A minimal phrase list you can paste into a file
  - A brief post-run analysis checklist

---

## 15) Quick Reference Snippet (for copy-paste)

- File to create: TEST_PLAN.md at the repo root
- Core sections: Goals, Test Matrix, Data Model, Runbook, Hallucination Metrics, Endurance Plan, Deliverables, Risks
- Metrics template: per-variant latency, drift_score, coherence_score, transcription_accuracy, cleaning_coherence, total_time

---

If you'd like, I can tailor this into a more compact one-page sprint plan, or produce a concrete 60-minute test matrix (25 phrases × 3 variants) with a ready-to-run step-by-step runbook. Tell me your preferred endurance target and how many variants you want in the initial pass, and I'll lock in the specifics.