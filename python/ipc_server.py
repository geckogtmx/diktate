"""
IPC Server for dIKtate
Handles JSON-based communication between Electron and Python backend
"""

import sys
import json
import threading
import logging
import time
import warnings
from enum import Enum

# Silence pycaw/comtypes deprecation warnings
warnings.filterwarnings("ignore", category=UserWarning, module="pycaw")
from pathlib import Path
from typing import Optional, Dict
import wave
import socket
from pynput import keyboard

# --- FIX: Inject NVIDIA DLL paths for ctranslate2/faster-whisper ---
import os
import sys
from pathlib import Path

def _add_nvidia_paths():
    """Add NVIDIA library paths from site-packages to PATH."""
    try:
        # Standard venv site-packages location on Windows
        site_packages = Path(sys.prefix) / "Lib" / "site-packages"
        nvidia_path = site_packages / "nvidia"
        
        if nvidia_path.exists():
            # Add cublas and cudnn bin directories
            dll_paths = [
                nvidia_path / "cublas" / "bin",
                nvidia_path / "cudnn" / "bin"
            ]
            
            for p in dll_paths:
                if p.exists():
                    os.add_dll_directory(str(p)) # Python 3.8+ Windows safety
                    os.environ["PATH"] = str(p) + os.pathsep + os.environ["PATH"]
                    
    except Exception as e:
        print(f"Warning: Failed to inject NVIDIA paths: {e}")

_add_nvidia_paths()
# -------------------------------------------------------------------

# Add core module to path
sys.path.insert(0, str(Path(__file__).parent))

from core import Recorder, Transcriber, Injector
from core.processor import create_processor
from core.mute_detector import MuteDetector
from core.system_monitor import SystemMonitor
from config.prompts import get_translation_prompt, get_prompt
from utils.security import redact_text, sanitize_log_message
from utils.history_manager import HistoryManager

# --- SECURITY: Guaranteed audio file cleanup on exit (M3 fix) ---
import atexit

def _cleanup_temp_audio_files():
    """Guaranteed cleanup of temp audio files on exit (even abnormal)."""
    try:
        temp_dir = Path("./temp_audio")
        if temp_dir.exists():
            for audio_file in temp_dir.glob("*.wav"):
                try:
                    audio_file.unlink()
                except Exception:
                    pass  # Best effort cleanup
    except Exception:
        pass  # Fail silently on cleanup

atexit.register(_cleanup_temp_audio_files)
# -----------------------------------------------------------------

# Configure logging - Session-based log files
log_dir = Path(Path.home()) / ".diktate" / "logs"
log_dir.mkdir(parents=True, exist_ok=True)

# Create session-specific log file with timestamp
from datetime import datetime
session_timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
session_log_file = log_dir / f"diktate_{session_timestamp}.log"

# Cleanup old log files (keep last 10 sessions)
def cleanup_old_logs(log_dir: Path, keep_count: int = 10):
    """Remove old log files, keeping only the most recent ones."""
    try:
        log_files = sorted(log_dir.glob("diktate_*.log"), key=lambda f: f.stat().st_mtime, reverse=True)
        for old_log in log_files[keep_count:]:
            try:
                old_log.unlink()
            except Exception:
                pass  # Ignore errors deleting old logs
    except Exception:
        pass  # Ignore errors listing logs

cleanup_old_logs(log_dir)

# Build handlers list - StreamHandler only in debug mode to avoid leaking transcripts
import os
log_handlers = [logging.FileHandler(session_log_file)]
if os.environ.get("DEBUG") == "1":
    log_handlers.append(logging.StreamHandler())

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=log_handlers
)
logger = logging.getLogger(__name__)
logger.info(f"Session log: {session_log_file}")



# State and stats classes below...


class State(Enum):
    """Pipeline states"""
    IDLE = "idle"
    RECORDING = "recording"
    PROCESSING = "processing"
    INJECTING = "injecting"
    WARMUP = "warmup"
    ERROR = "error"


class SessionStats:
    """Track session-level statistics for observability (A.2)"""

    def __init__(self):
        self.dictation_count: int = 0
        self.success_count: int = 0
        self.error_count: int = 0
        self.total_chars: int = 0
        self.total_time_ms: float = 0.0
        self.session_start: float = time.time()

    def record_success(self, chars: int, time_ms: float) -> None:
        """Record a successful dictation"""
        self.dictation_count += 1
        self.success_count += 1
        self.total_chars += chars
        self.total_time_ms += time_ms

    def record_error(self) -> None:
        """Record a failed dictation"""
        self.dictation_count += 1
        self.error_count += 1

    def get_summary(self) -> Dict:
        """Get session summary statistics"""
        session_duration = time.time() - self.session_start
        avg_time = self.total_time_ms / self.success_count if self.success_count > 0 else 0
        return {
            "dictations": self.dictation_count,
            "successes": self.success_count,
            "errors": self.error_count,
            "total_chars": self.total_chars,
            "avg_time_ms": round(avg_time, 0),
            "session_duration_s": round(session_duration, 1)
        }


class PerformanceMetrics:
    """Track performance metrics for the pipeline"""

    def __init__(self):
        self.metrics: Dict[str, float] = {}
        self.start_times: Dict[str, float] = {}

    def start(self, metric_name: str) -> None:
        """Start timing a metric"""
        self.start_times[metric_name] = time.time()

    def end(self, metric_name: str) -> float:
        """End timing a metric and return duration"""
        if metric_name not in self.start_times:
            logger.warning(f"Attempted to end non-existent metric: {metric_name}")
            return 0.0

        duration = (time.time() - self.start_times[metric_name]) * 1000  # Convert to ms
        self.metrics[metric_name] = duration
        del self.start_times[metric_name]

        logger.info(f"[PERF] {metric_name}: {duration:.0f}ms")
        return duration

    def get_metrics(self) -> Dict[str, float]:
        """Get all recorded metrics"""
        return self.metrics.copy()

    def reset(self) -> None:
        """Reset all metrics"""
        self.metrics.clear()
        self.start_times.clear()
    
    def save_to_json(self, session_id: str, log_dir: Path) -> None:
        """Append metrics to a JSON file (A.2)"""
        try:
            metrics_file = log_dir / "metrics.json"
            entry = {
                "timestamp": time.time(),
                "session_id": session_id,
                **self.metrics
            }
            
            # Read existing or create new
            data = []
            if metrics_file.exists():
                try:
                    with open(metrics_file, 'r') as f:
                        data = json.load(f)
                        if not isinstance(data, list):
                            data = []
                except:
                    data = []
            
            data.append(entry)
            
            # Keep only last 1000 entries
            if len(data) > 1000:
                data = data[-1000:]
                
            with open(metrics_file, 'w') as f:
                json.dump(data, f, indent=2)
                
        except Exception as e:
            logger.warning(f"Failed to save metrics to JSON: {e}")
    
    def log_inference_time(self, model: str, duration_ms: float, log_dir: Path) -> None:
        """Log inference time to JSON file and alert on 2s+ threshold (A.1)"""
        try:
            # Alert if processing exceeds 2-second threshold
            if duration_ms > 2000:
                logger.warning(f"[SLOW INFERENCE] {model} took {duration_ms:.0f}ms (> 2000ms threshold)")
            
            # Log to inference_times.json
            inference_file = log_dir / "inference_times.json"
            entry = {
                "timestamp": time.time(),
                "model": model,
                "duration_ms": round(duration_ms, 2),
                "threshold_exceeded": duration_ms > 2000
            }
            
            # Read existing or create new
            data = []
            if inference_file.exists():
                try:
                    with open(inference_file, 'r') as f:
                        data = json.load(f)
                        if not isinstance(data, list):
                            data = []
                except:
                    data = []
            
            data.append(entry)
            
            # Keep only last 500 entries
            if len(data) > 500:
                data = data[-500:]
                
            with open(inference_file, 'w') as f:
                json.dump(data, f, indent=2)
                
        except Exception as e:
            logger.warning(f"Failed to log inference time: {e}")


class IpcServer:
    """Server for handling IPC commands from Electron"""

    def __init__(self):
        """Initialize the IPC server"""
        self.state = State.WARMUP # Start in WARMUP state for startup visibility
        self.recorder: Optional[Recorder] = None
        self.transcriber: Optional[Transcriber] = None
        self.processor: Optional[Processor] = None
        self.injector: Optional[Injector] = None
        self.recording = False
        self.recording_mode = "dictate"  # 'dictate', 'ask', 'refine', or 'translate'
        self.audio_file = None
        self.perf = PerformanceMetrics()
        self.session_stats = SessionStats()  # Session-level stats (A.2)
        self.trans_mode = "none"  # Translation mode: none, es-en, en-es
        self.consecutive_failures = 0  # Track consecutive processor failures for auto-recovery
        self.custom_prompts = {}  # Custom prompts: mode -> prompt_text mapping
        self.current_mode = "standard"  # Track current processing mode for raw bypass
        self.last_injected_text = None  # Store last injected text for "Oops" feature (Ctrl+Alt+V)

        # IPC Authentication (SPEC_007)
        self.ipc_token = os.environ.get("DIKTATE_IPC_TOKEN", "")
        if not self.ipc_token:
            logger.warning("[SECURITY] No IPC authentication token found in environment - server will reject all external commands")
        else:
            logger.info("[SECURITY] IPC authentication enabled")

        # Mute detection
        self.mute_detector: Optional[MuteDetector] = None
        self.mute_monitor_thread: Optional[threading.Thread] = None
        self.mute_monitor_active = False
        self.last_known_mute_state = None  # Will be set by first check in monitor loop

        # System monitoring (SPEC_027)
        self.system_monitor = SystemMonitor()
        self.activity_counter = 0  # Count activities for 1-in-10 sampling
        self.sample_interval = 10  # Sample every 10th activity
        self.monitor_thread: Optional[threading.Thread] = None
        self.should_monitor = False  # Flag to control monitoring thread

        # History logging (SPEC_029)
        self.history_manager: Optional[HistoryManager] = None
        try:
            self.history_manager = HistoryManager()
            logger.info("[HISTORY] Initialized SQLite history logging")
        except Exception as e:
            logger.error(f"[HISTORY] Failed to initialize history manager: {e}")

        logger.info("Initializing IPC Server...")
        self._initialize_components()

        # Start warmup in background thread to allow Electron to connect immediately
        threading.Thread(target=self._startup_warmup, daemon=True).start()

    def _startup_warmup(self):
        """Asynchronous startup warmup sequence"""
        try:
            self._ensure_ollama_ready()

            # CRITICAL FIX: Re-initialize processor if it failed during __init__
            if self.processor is None:
                logger.info("[RECOVERY] Attempting to re-initialize processor after Ollama startup...")
                try:
                    self.processor = create_processor()
                    logger.info("[OK] Processor initialized successfully after Ollama startup")
                except Exception as e:
                    logger.error(f"[RECOVERY] Failed to re-initialize processor: {e}")
                    logger.warning("Text processing will use raw transcription fallback")

            logger.info("Startup warmup complete")

            # Auto-prune history on startup (SPEC_029)
            if self.history_manager:
                try:
                    deleted = self.history_manager.prune_history(days=90)
                    if deleted > 0:
                        logger.info(f"[HISTORY] Pruned {deleted} old records during startup")
                except Exception as e:
                    logger.warning(f"[HISTORY] Auto-pruning failed: {e}")

            # Emit startup system metrics (SPEC_027)
            try:
                startup_metrics = self.system_monitor.get_snapshot()
                self._emit_event('system-metrics', {
                    'phase': 'startup',
                    'metrics': startup_metrics
                })
                logger.info(f"[SystemMonitor] Startup metrics: {self.system_monitor.get_summary()}")
            except Exception as e:
                logger.warning(f"[SystemMonitor] Failed to emit startup metrics: {e}")

            # Start background metrics monitoring (Phase 2)
            self._start_metrics_monitoring()

        except Exception as e:
            logger.warning(f"Startup warmup encountered issues: {e}")
        finally:
            self._set_state(State.IDLE)
            logger.info("IPC Server ready")

    def _ensure_ollama_ready(self):
        """Ensure Ollama is running and model is warmed up at startup."""
        try:
            import requests
            import subprocess
            
            # 1. Check if Ollama is running
            try:
                response = requests.get("http://localhost:11434/api/tags", timeout=2)
                if response.status_code == 200:
                    logger.info("[STARTUP] Ollama is already running")
                else:
                    logger.warning(f"[STARTUP] Ollama returned status {response.status_code}")
                    return
            except requests.ConnectionError:
                logger.warning("[STARTUP] Ollama not running, attempting to start...")
                
                # 2. Try to start Ollama (Windows)
                try:
                    # Start Ollama in background (Windows)
                    subprocess.Popen(
                        ["ollama", "serve"],
                        creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL
                    )
                    time.sleep(3)  # Wait for startup
                    logger.info("[STARTUP] Ollama started successfully")
                except FileNotFoundError:
                    logger.error("[STARTUP] Ollama not found in PATH - user must start manually")
                    return
                except Exception as e:
                    logger.error(f"[STARTUP] Failed to start Ollama: {e}")
                    return
            
            # 3. Warm up default model (gemma3:4b)
            # Use environment or fallback
            default_model = os.environ.get("DEFAULT_OLLAMA_MODEL", "gemma3:4b")
            logger.info(f"[STARTUP] Warming up {default_model}...")
            
            try:
                warmup_response = requests.post(
                    "http://localhost:11434/api/generate",
                    json={
                        "model": default_model,
                        "prompt": "",
                        "stream": False,
                        "options": {"num_ctx": 2048, "num_predict": 1},
                        "keep_alive": "10m"
                    },
                    timeout=30
                )
                
                if warmup_response.status_code == 200:
                    logger.info(f"[STARTUP] Model {default_model} ready and cached")
                else:
                    logger.warning(f"[STARTUP] Model warmup returned status {warmup_response.status_code}")
            except Exception as e:
                logger.warning(f"[STARTUP] Model warmup failed (will retry on first use): {e}")
                
        except Exception as e:
            logger.warning(f"[STARTUP] Ollama startup check failed (non-fatal): {e}")

    def _start_mute_monitoring(self):
        """Start background thread to monitor microphone mute state."""
        # Get selected device label from config
        device_label = os.environ.get("AUDIO_DEVICE_LABEL", "Default")

        self.mute_detector = MuteDetector(device_label=device_label)
        self.mute_monitor_active = True

        self.mute_monitor_thread = threading.Thread(
            target=self._mute_monitor_loop,
            daemon=True
        )
        self.mute_monitor_thread.start()
        logger.info(f"[MUTE_MONITOR] Started monitoring device: {device_label}")

    def _mute_monitor_loop(self):
        """Background loop to check mute state every 3 seconds."""
        # Initialize COM for this thread (required for pycaw/Windows COM)
        try:
            from comtypes import CoInitialize, CoUninitialize
            CoInitialize()
            logger.info("[MUTE_MONITOR] COM initialized for monitoring thread")
        except Exception as e:
            logger.error(f"[MUTE_MONITOR] Failed to initialize COM: {e}")
            return

        try:
            # IMMEDIATE FIRST CHECK (don't wait 3 seconds)
            mute_state = self.mute_detector.check_mute_state()

            if mute_state is not None:
                self.last_known_mute_state = mute_state
                logger.info(f"[MUTE_MONITOR] Initial mute state: {mute_state}")
                self._emit_event("mic-status", {
                    "muted": mute_state,
                    "timestamp": time.time()
                })
            else:
                # If check fails, assume unmuted (safe default)
                self.last_known_mute_state = False
                logger.warning("[MUTE_MONITOR] Initial check failed - assuming unmuted")

            # Continue with normal loop
            while self.mute_monitor_active:
                try:
                    mute_state = self.mute_detector.check_mute_state()

                    if mute_state is not None and mute_state != self.last_known_mute_state:
                        # Mute state changed - emit event
                        self.last_known_mute_state = mute_state
                        logger.info(f"[MUTE_MONITOR] Mute state changed: {mute_state}")

                        self._emit_event("mic-status", {
                            "muted": mute_state,
                            "timestamp": time.time()
                        })

                    time.sleep(3)  # Check every 3 seconds

                except Exception as e:
                    logger.error(f"[MUTE_MONITOR] Error in monitor loop: {e}")
                    time.sleep(5)  # Back off on error
        finally:
            # Uninitialize COM when thread exits
            try:
                CoUninitialize()
                logger.info("[MUTE_MONITOR] COM uninitialized")
            except Exception:
                pass

    def _start_metrics_monitoring(self):
        """Start background thread for periodic system metrics sampling (Phase 2)"""
        if self.monitor_thread and self.should_monitor:
            logger.info("[METRICS] Background monitoring already running")
            return

        self.should_monitor = True
        self.monitor_thread = threading.Thread(
            target=self._metrics_monitor_loop,
            daemon=True,
            name="MetricsMonitorThread"
        )
        self.monitor_thread.start()
        logger.info("[METRICS] Started background metrics monitoring (60s interval)")

    def _metrics_monitor_loop(self):
        """Background loop that captures system metrics every 60 seconds"""
        while self.should_monitor:
            try:
                # Wait 60 seconds before next sample
                time.sleep(60)

                # Capture background probe metrics
                self._capture_system_metrics('background_probe')

            except Exception as e:
                logger.error(f"[METRICS] Error in monitoring loop: {e}")
                time.sleep(60)  # Back off on error

    def _initialize_components(self) -> None:
        """Initialize all pipeline components"""
        try:
            self.recorder = Recorder()
            logger.info("[OK] Recorder initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Recorder: {e}")
            self._send_error(f"Recorder initialization failed: {e}")

        try:
            # Default to Turbo for speed (V3)
            self.transcriber = Transcriber(model_size="turbo", device="auto")
            logger.info("[OK] Transcriber initialized (Turbo V3)")
        except Exception as e:
            logger.error(f"Failed to initialize Transcriber: {e}")
            self._send_error(f"Transcriber initialization failed: {e}")

        try:
            self.processor = create_processor()
            logger.info("[OK] Processor initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Processor: {e}")
            logger.warning("Text processing will be skipped if unavailable")

        try:
            self.injector = Injector()
            logger.info(f"[OK] Injector initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Injector: {e}")
            self._send_error(f"Injector initialization failed: {e}")


    def _set_state(self, new_state: State) -> None:
        """Set pipeline state and emit event"""
        old_state = self.state
        logger.info(f"State transition: {old_state.value} -> {new_state.value}")
        self.state = new_state
        self._emit_event("state-change", {"state": new_state.value})

        # System monitoring hooks (SPEC_027)
        # Increment counter when starting ANY activity (leaving idle state)
        # This includes: dictate, ask, translate, refine (with/without recording)
        if old_state == State.IDLE and new_state != State.IDLE and new_state != State.WARMUP:
            self.activity_counter += 1
            logger.debug(f"[SystemMonitor] Activity count: {self.activity_counter}")

            # Start parallel monitoring every Nth activity
            if self.activity_counter % self.sample_interval == 0:
                logger.info(f"[SystemMonitor] Starting parallel monitoring for activity #{self.activity_counter}")
                self._start_parallel_monitoring()

        # Stop monitoring and emit post-activity snapshot when returning to idle
        if new_state == State.IDLE and old_state != State.IDLE:
            # Stop monitoring thread if running
            if self.should_monitor:
                self._stop_parallel_monitoring()

                # Emit post-activity snapshot if this was a sampled activity
                if self.activity_counter % self.sample_interval == 0:
                    try:
                        post_metrics = self.system_monitor.get_snapshot()
                        self._emit_event('system-metrics', {
                            'phase': 'post-activity',
                            'activity_count': self.activity_counter,
                            'metrics': post_metrics
                        })
                        logger.debug(f"[SystemMonitor] Post-activity metrics: {self.system_monitor.get_summary()}")
                    except Exception as e:
                        logger.warning(f"[SystemMonitor] Failed to emit post-activity metrics: {e}")

    def _on_recording_auto_stopped(self, max_duration: int) -> None:
        """Callback when recording is auto-stopped due to duration limit."""
        logger.info(f"[AUTO-STOP] Recording reached max duration ({max_duration}s)")
        self._emit_event("recording-auto-stopped", {
            "max_duration": max_duration,
            "message": f"Recording auto-stopped after {max_duration} seconds"
        })

    def start_recording(self, device_id: Optional[str] = None, device_label: Optional[str] = None,
                       mode: str = "dictate", max_duration: int = 0) -> dict:
        """Start recording audio

        Args:
            device_id: Audio device ID
            device_label: Audio device label for matching
            mode: 'dictate' for normal dictation, 'ask' for Q&A mode, 'refine' for instruction mode, 'translate' for translation
            max_duration: Maximum recording duration in seconds (0 = unlimited)
        """
        # Allow starting from IDLE or ERROR states (to recover from errors)
        if self.state not in [State.IDLE, State.ERROR]:
            if self.state == State.WARMUP:
                error_msg = "Still loading model, please wait..."
            else:
                error_msg = f"Cannot start recording in {self.state.value} state"
            logger.warning(error_msg)
            return {"success": False, "error": error_msg}

        # Check mute state before attempting to record
        if self.last_known_mute_state:
            logger.warning("[REC] Blocked: Microphone is muted")
            self._emit_event("mic-muted", {
                "message": "Microphone is muted. Please unmute and try again."
            })
            return {"success": False, "error": "Microphone is muted", "code": "MIC_MUTED"}

        try:
            # Reset metrics for new session
            self.perf.reset()
            self.perf.start("total")
            self.perf.start("recording")

            # Store the mode for processing
            self.recording_mode = mode
            duration_msg = f" (max: {max_duration}s)" if max_duration > 0 else " (unlimited)"
            logger.info(f"[REC] Recording started in {mode} mode{duration_msg}")

            self._set_state(State.RECORDING)
            self.recorder.start(
                device_id=device_id,
                device_label=device_label,
                max_duration=max_duration,
                auto_stop_callback=self._on_recording_auto_stopped
            )
            self.recording = True
            return {"success": True}
        except Exception as e:
            error_msg = str(e)
            # Check if error is due to muted microphone
            if "muted" in error_msg.lower():
                logger.warning(f"[REC] Microphone muted: {error_msg}")
                self._emit_event("mic-muted", {"message": "Microphone is muted. Please unmute and try again."})
                self._set_state(State.IDLE)  # Don't go to ERROR state for mute
                return {"success": False, "error": error_msg, "code": "MIC_MUTED"}
            else:
                logger.error(sanitize_log_message(f"Failed to start recording: {e}"))
                self._set_state(State.ERROR)
                return {"success": False, "error": error_msg}

    def stop_recording(self) -> dict:
        """Stop recording and process the audio"""
        if self.state != State.RECORDING:
            # If we are already stopped/processing, consider this a success (idempotent)
            # This prevents the "Cannot stop recording in X state" error from breaking the flow
            msg = f"Stop requested but state is {self.state.value} (not RECORDING). Treating as success."
            logger.info(msg)
            return {"success": True, "warning": msg}

        self.recording = False
        try:
            self.recorder.stop()
            self.perf.end("recording")
            logger.info(f"[STOP] Recording stopped (mode: {self.recording_mode})")

            # Save audio to temporary file
            self.audio_file = os.path.join(self.recorder.temp_dir, "recording.wav")
            self.recorder.save_to_file(self.audio_file)

            # Process based on mode
            if self.recording_mode == "ask":
                thread = threading.Thread(target=self._process_ask_recording)
            elif self.recording_mode == "refine":
                thread = threading.Thread(target=self._process_refine_recording)
            else:
                thread = threading.Thread(target=self._process_recording)
            thread.start()

            return {"success": True}

        except Exception as e:
            logger.error(sanitize_log_message(f"Error stopping recording: {e}"))
            self._set_state(State.ERROR)
            return {"success": False, "error": str(e)}

    def _process_recording(self) -> None:
        """Process the recorded audio through the pipeline"""
        try:
            self._set_state(State.PROCESSING)

            # Determine if translation is requested for this specific session
            is_translate_session = self.recording_mode == 'translate'
            
            # Trigger mode takes precedence; otherwise use global trans_mode 
            # but EXCLUDE 'auto' from global dictation (auto is trigger-only now)
            effective_trans_mode = 'auto' if is_translate_session else (
                self.trans_mode if self.trans_mode != 'auto' else 'none'
            )

            # Log audio file metadata (A.2 observability)
            if self.audio_file:
                try:
                    audio_size = os.path.getsize(self.audio_file)
                    with wave.open(self.audio_file, 'rb') as wf:
                        frames = wf.getnframes()
                        rate = wf.getframerate()
                        audio_duration = frames / float(rate)
                    # Log model versions for this dictation
                    transcriber_model = getattr(self.transcriber, 'model_size', 'unknown')
                    processor_model = getattr(self.processor, 'model', 'unknown') if self.processor else 'none'
                    logger.info(f"[AUDIO] Duration: {audio_duration:.2f}s, Size: {audio_size} bytes")
                    logger.info(f"[MODELS] Transcriber: {transcriber_model}, Processor: {processor_model}")
                except Exception as e:
                    logger.warning(f"Could not read audio metadata: {e}")

            # Transcribe - uses trans_mode to determine if auto-detection is needed
            logger.info("[TRANSCRIBE] Transcribing audio...")
            self.perf.start("transcription")
            
            # Pass None for language if we are in auto translation mode to allow Whisper to detect
            target_lang = None if effective_trans_mode == 'auto' else 'en'
            raw_text = self.transcriber.transcribe(self.audio_file, language=target_lang)
            self.perf.end("transcription")
            logger.info(f"[RESULT] Transcribed: {redact_text(raw_text)}")

            if not raw_text or not raw_text.strip():
                logger.info("[PROCESS] Empty transcription, skipping processing and injection")
                self._set_state(State.IDLE)
                return

            # RAW MODE BYPASS: Skip LLM processing entirely for raw mode
            if self.current_mode == 'raw':
                logger.info("[RAW] Raw mode enabled - skipping LLM processing (true passthrough)")
                processed_text = raw_text  # Use literal Whisper output
                self.perf.start("processing")
                self.perf.end("processing")  # Log 0ms processing time
                logger.info(f"[RESULT] Raw output: {redact_text(processed_text)}")
            else:
                # Process (clean up text) with automatic fallback on failure
                logger.info("[PROCESS] Processing text...")
                self.perf.start("processing")
                processor_failed = False

                if self.processor:
                    try:
                        processed_text = self.processor.process(raw_text)
                        # Success - reset consecutive failures counter
                        if self.consecutive_failures > 0:
                            logger.info(f"[RECOVERY] Processor recovered after {self.consecutive_failures} failures")
                        self.consecutive_failures = 0
                    except Exception as e:
                        # Processor failed - fall back to raw transcription
                        logger.error(f"[FALLBACK] Processor failed: {e}")
                        logger.info("[FALLBACK] Using raw transcription (no processing)")
                        processed_text = raw_text
                        processor_failed = True
                        self.consecutive_failures += 1

                        # Emit fallback notification
                        self._emit_event("processor-fallback", {
                            "reason": str(e),
                            "consecutive_failures": self.consecutive_failures,
                            "using_raw": True
                        })
                else:
                    processed_text = raw_text

                processing_time = self.perf.end("processing")

                # Log inference time for model monitoring (A.1) - only if processing succeeded
                if self.processor and not processor_failed:
                    processor_model = getattr(self.processor, 'model', 'unknown')
                    self.perf.log_inference_time(processor_model, processing_time, log_dir)
                logger.info(f"[RESULT] Processed: {redact_text(processed_text)}")

            # Optional: Translate (post-processing)
            if effective_trans_mode and effective_trans_mode != "none":
                trans_prompt = get_translation_prompt(effective_trans_mode)
                if trans_prompt and self.processor:
                    logger.info(f"[TRANSLATE] Translating ({effective_trans_mode})...")
                    self.perf.start("translation")
                    # Use the processor to translate with a custom prompt
                    original_prompt = self.processor.prompt
                    self.processor.prompt = trans_prompt
                    processed_text = self.processor.process(processed_text)
                    self.processor.prompt = original_prompt  # Restore
                    self.perf.end("translation")
                    logger.info(f"[RESULT] Translated: {redact_text(processed_text)}")

            # Inject text
            self._set_state(State.INJECTING)
            logger.info("[INJECT] Injecting text...")
            self.perf.start("injection")

            # Configure trailing space behavior (if config available)
            if hasattr(self, 'config') and self.config:
                trailing_space_enabled = self.config.get('trailingSpaceEnabled', True)
                self.injector.add_trailing_space = trailing_space_enabled
                if not trailing_space_enabled:
                    logger.debug("[INJECT] Trailing space disabled for this injection")

            self.injector.type_text(processed_text)
            self.last_injected_text = processed_text  # Capture for "Oops" feature

            # Optional Additional Key: Press Enter/Tab after paste (if configured)
            if hasattr(self, 'config') and self.config:
                additional_key_enabled = self.config.get('additionalKeyEnabled', False)
                additional_key = self.config.get('additionalKey', 'none')

                if additional_key_enabled and additional_key and additional_key != 'none':
                    # Safety delay: Wait for paste to complete before pressing additional key
                    # This prevents the key from being captured by clipboard managers
                    # or being sent before the OS processes the paste + space
                    time.sleep(0.1)  # 100ms delay (configurable if needed)

                    try:
                        self.injector.press_key(additional_key)
                        logger.info(f"[INJECT] Additional Key: Pressed '{additional_key}' after paste + space")
                    except Exception as e:
                        logger.error(f"[INJECT] Additional key press failed: {e}")
                        # Non-fatal: Continue even if key press fails

            self.perf.end("injection")
            logger.info("[SUCCESS] Text injected successfully")

            # End total timing and log all metrics
            self.perf.end("total")
            metrics = self.perf.get_metrics()
            metrics["charCount"] = len(processed_text)  # Add char count for token stats
            logger.info(f"[PERF] Session complete - Total: {metrics.get('total', 0):.0f}ms, Chars: {metrics['charCount']}")
            self._emit_event("performance-metrics", metrics)

            # Persist metrics to JSON (A.2)
            self.perf.save_to_json(session_timestamp, log_dir)

            # Record session stats (A.2)
            self.session_stats.record_success(len(processed_text), metrics.get('total', 0))

            # Log to history database (SPEC_029)
            if self.history_manager:
                try:
                    self.history_manager.log_session({
                        'mode': self.recording_mode,
                        'transcriber_model': getattr(self.transcriber, 'model_size', 'unknown'),
                        'processor_model': getattr(self.processor, 'model', 'unknown') if self.processor else 'none',
                        'raw_text': raw_text,
                        'processed_text': processed_text,
                        'audio_duration_s': audio_duration if 'audio_duration' in locals() else None,
                        'transcription_time_ms': metrics.get('transcription', 0),
                        'processing_time_ms': metrics.get('processing', 0),
                        'total_time_ms': metrics.get('total', 0),
                        'success': True,
                        'error_message': None
                    })
                except Exception as e:
                    logger.warning(f"[HISTORY] Failed to log session: {e}")

            # Capture system metrics after successful recording (Phase 2)
            self._capture_system_metrics('post_recording')

            # Cleanup
            if self.audio_file:
                try:
                    os.remove(self.audio_file)
                except Exception as e:
                    logger.warning(f"Failed to delete temporary audio file: {e}")

            self._set_state(State.IDLE)

        except Exception as e:
            logger.error(sanitize_log_message(f"Pipeline error: {e}"))
            self.session_stats.record_error()  # Track errors (A.2)

            # Log error to history database (SPEC_029)
            if self.history_manager:
                try:
                    self.history_manager.log_session({
                        'mode': self.recording_mode,
                        'transcriber_model': getattr(self.transcriber, 'model_size', 'unknown'),
                        'processor_model': getattr(self.processor, 'model', 'unknown') if self.processor else 'none',
                        'raw_text': None,
                        'processed_text': None,
                        'audio_duration_s': None,
                        'transcription_time_ms': None,
                        'processing_time_ms': None,
                        'total_time_ms': None,
                        'success': False,
                        'error_message': str(e)
                    })
                except Exception as hist_e:
                    logger.warning(f"[HISTORY] Failed to log error: {hist_e}")

            self._set_state(State.ERROR)

    def _process_ask_recording(self) -> None:
        """Process the recorded audio as a question for Q&A mode"""
        try:
            self._set_state(State.PROCESSING)
            logger.info("[ASK] Processing question...")

            # Log audio file metadata
            if self.audio_file:
                try:
                    audio_size = os.path.getsize(self.audio_file)
                    with wave.open(self.audio_file, 'rb') as wf:
                        frames = wf.getnframes()
                        rate = wf.getframerate()
                        audio_duration = frames / float(rate)
                    logger.info(f"[AUDIO] Duration: {audio_duration:.2f}s, Size: {audio_size} bytes")
                except Exception as e:
                    logger.warning(f"Could not read audio metadata: {e}")

            # Transcribe the question
            logger.info("[TRANSCRIBE] Transcribing question...")
            self.perf.start("transcription")
            question = self.transcriber.transcribe(self.audio_file)
            self.perf.end("transcription")
            logger.info(f"[QUESTION] {redact_text(question)}")

            if not question or not question.strip():
                logger.info("[ASK] Empty question, skipping")
                self._emit_event("ask-response", {"success": False, "error": "No question detected"})
                self._set_state(State.IDLE)
                return

            # Ask the LLM (use processor with Q&A prompt)
            if self.processor:
                logger.info("[ASK] Asking LLM...")
                self.perf.start("ask")

                # Store original prompt and use Q&A prompt
                original_prompt = self.processor.prompt
                self.processor.prompt = """You are a helpful AI assistant. The user has asked you a question via voice.
Answer the question concisely and helpfully. Be direct and informative.

USER QUESTION: {text}

YOUR ANSWER:"""

                try:
                    answer = self.processor.process(question)
                    # Success - reset consecutive failures
                    if self.consecutive_failures > 0:
                        logger.info(f"[RECOVERY] Processor recovered after {self.consecutive_failures} failures")
                    self.consecutive_failures = 0

                    self.perf.end("ask")
                    logger.info(f"[ANSWER] {redact_text(answer)}")

                    # Emit the response (don't inject)
                    self._emit_event("ask-response", {
                        "success": True,
                        "question": question.strip(),
                        "answer": answer.strip()
                    })
                except Exception as e:
                    # Ask mode failure - no fallback, just return error
                    logger.error(f"[ASK] Processor failed: {e}")
                    self.consecutive_failures += 1
                    self.perf.end("ask")

                    self._emit_event("ask-response", {
                        "success": False,
                        "error": f"LLM failed after retries: {str(e)}",
                        "consecutive_failures": self.consecutive_failures
                    })
                finally:
                    # Always restore original prompt
                    self.processor.prompt = original_prompt
            else:
                logger.error("[ASK] No processor available")
                self._emit_event("ask-response", {"success": False, "error": "No LLM processor available"})

            # End total timing
            self.perf.end("total")
            metrics = self.perf.get_metrics()
            logger.info(f"[PERF] Ask complete - Total: {metrics.get('total', 0):.0f}ms")

            # Log to history database (SPEC_029)
            if self.history_manager:
                try:
                    self.history_manager.log_session({
                        'mode': 'ask',
                        'transcriber_model': getattr(self.transcriber, 'model_size', 'unknown'),
                        'processor_model': getattr(self.processor, 'model', 'unknown') if self.processor else 'none',
                        'raw_text': question if 'question' in locals() else None,
                        'processed_text': answer if 'answer' in locals() else None,
                        'audio_duration_s': audio_duration if 'audio_duration' in locals() else None,
                        'transcription_time_ms': metrics.get('transcription', 0),
                        'processing_time_ms': metrics.get('ask', 0),
                        'total_time_ms': metrics.get('total', 0),
                        'success': True,
                        'error_message': None
                    })
                except Exception as e:
                    logger.warning(f"[HISTORY] Failed to log ask session: {e}")

            # Capture system metrics after successful ask (Phase 2)
            self._capture_system_metrics('post_recording')

            # Cleanup
            if self.audio_file:
                try:
                    os.remove(self.audio_file)
                except Exception as e:
                    logger.warning(f"Failed to delete temporary audio file: {e}")

            self._set_state(State.IDLE)

        except Exception as e:
            logger.error(sanitize_log_message(f"Ask pipeline error: {e}"))
            self._emit_event("ask-response", {"success": False, "error": str(e)})

            # Log error to history database (SPEC_029)
            if self.history_manager:
                try:
                    self.history_manager.log_session({
                        'mode': 'ask',
                        'transcriber_model': getattr(self.transcriber, 'model_size', 'unknown'),
                        'processor_model': getattr(self.processor, 'model', 'unknown') if self.processor else 'none',
                        'raw_text': None,
                        'processed_text': None,
                        'audio_duration_s': None,
                        'transcription_time_ms': None,
                        'processing_time_ms': None,
                        'total_time_ms': None,
                        'success': False,
                        'error_message': str(e)
                    })
                except Exception as hist_e:
                    logger.warning(f"[HISTORY] Failed to log ask error: {hist_e}")

            self._set_state(State.ERROR)

    def _process_refine_recording(self) -> None:
        """Process recorded audio as an instruction for refining selected text (SPEC_025).

        Workflow:
        1. Transcribe audio -> instruction
        2. Capture selected text
        3. If no selection: fallback to Ask mode (answer instruction directly)
        4. If selection exists: use instruction as prompt to refine text
        5. Inject refined result
        """
        try:
            self._set_state(State.PROCESSING)
            logger.info("[REFINE-INST] Processing refine instruction...")

            # Log audio metadata
            if self.audio_file:
                try:
                    audio_size = os.path.getsize(self.audio_file)
                    with wave.open(self.audio_file, 'rb') as wf:
                        frames = wf.getnframes()
                        rate = wf.getframerate()
                        audio_duration = frames / float(rate)
                    logger.info(f"[AUDIO] Duration: {audio_duration:.2f}s, Size: {audio_size} bytes")
                except Exception as e:
                    logger.warning(f"Could not read audio metadata: {e}")

            # Step 1: Transcribe the instruction
            logger.info("[TRANSCRIBE] Transcribing instruction...")
            self.perf.start("transcription")
            instruction = self.transcriber.transcribe(self.audio_file)
            self.perf.end("transcription")
            logger.info(f"[INSTRUCTION] {redact_text(instruction)}")

            if not instruction or not instruction.strip():
                logger.warning("[REFINE-INST] Empty instruction detected")
                self._emit_event("refine-instruction-error", {
                    "success": False,
                    "error": "No instruction detected",
                    "code": "EMPTY_INSTRUCTION"
                })
                self._set_state(State.IDLE)
                return

            # Step 2: Capture selected text
            logger.info("[REFINE-INST] Capturing selected text...")
            self.perf.start("capture")
            selected_text = self.injector.capture_selection(timeout_ms=1500)
            self.perf.end("capture")

            # Step 3: Check if selection is empty
            if not selected_text or not selected_text.strip():
                logger.info("[REFINE-INST] No selection found - fallback to Ask mode")

                # Fallback: treat instruction as a question
                if self.processor:
                    logger.info("[REFINE-INST] Processing instruction as question...")
                    self.perf.start("processing")

                    # Build Ask mode prompt
                    ask_prompt = """You are a helpful AI assistant. The user has asked you a question via voice.
Answer the question concisely and helpfully. Be direct and informative.

USER QUESTION: {text}

YOUR ANSWER:"""

                    try:
                        answer = self.processor.process(instruction, prompt_override=ask_prompt)
                        self.perf.end("processing")
                        logger.info(f"[ANSWER] {redact_text(answer)}")

                        # Copy answer to clipboard
                        import pyperclip
                        pyperclip.copy(answer.strip())

                        # Emit success (no injection, clipboard only)
                        self._emit_event("refine-instruction-fallback", {
                            "success": True,
                            "instruction": instruction.strip(),
                            "answer": answer.strip(),
                            "mode": "ask_fallback"
                        })
                    except Exception as e:
                        logger.error(f"[REFINE-INST] Processor failed in fallback: {e}")
                        self.perf.end("processing")
                        self._emit_event("refine-instruction-error", {
                            "success": False,
                            "error": f"Processing failed: {str(e)}",
                            "code": "PROCESSING_FAILED"
                        })
                else:
                    logger.error("[REFINE-INST] No processor available")
                    self._emit_event("refine-instruction-error", {
                        "success": False,
                        "error": "No LLM processor available",
                        "code": "NO_PROCESSOR"
                    })

                # End total timing and cleanup
                self.perf.end("total")
                if self.audio_file:
                    try:
                        os.remove(self.audio_file)
                    except Exception as e:
                        logger.warning(f"Failed to delete audio file: {e}")
                self._set_state(State.IDLE)
                return

            # Step 4: Process text with instruction as prompt
            logger.info(f"[REFINE-INST] Processing {len(selected_text)} chars with custom instruction")

            if self.processor:
                self.perf.start("processing")

                # Build instruction-based prompt
                refine_instruction_prompt = f"""You are a text editing assistant. Follow this instruction precisely:

INSTRUCTION: {instruction}

TEXT TO MODIFY:
{{text}}

Output only the modified text, nothing else:"""

                try:
                    refined_text = self.processor.process(selected_text, prompt_override=refine_instruction_prompt)
                    self.perf.end("processing")
                    logger.info(f"[REFINED] {len(refined_text)} chars")

                    # Step 5: Inject refined text
                    logger.info("[INJECT] Injecting refined text...")
                    self.perf.start("injection")
                    self.injector.paste_text(refined_text)

                    # Press additional key if configured
                    trailing_space_enabled = self.config.get('trailingSpaceEnabled', True) if hasattr(self, 'config') and self.config else True
                    additional_key_enabled = self.config.get('additionalKeyEnabled', False) if hasattr(self, 'config') and self.config else False
                    additional_key = self.config.get('additionalKey', 'enter') if hasattr(self, 'config') and self.config else 'enter'

                    if trailing_space_enabled:
                        self.injector.paste_text(" ")
                    if additional_key_enabled and additional_key:
                        self.injector.press_key(additional_key)

                    self.perf.end("injection")

                    # Store for Oops feature
                    self.last_injection = refined_text

                    # Emit success
                    self.perf.end("total")
                    metrics = self.perf.get_metrics()

                    self._emit_event("refine-instruction-success", {
                        "success": True,
                        "instruction": instruction.strip(),
                        "original_length": len(selected_text),
                        "refined_length": len(refined_text),
                        "metrics": {
                            "total_ms": int(metrics.get("total", 0)),
                            "transcription_ms": int(metrics.get("transcription", 0)),
                            "capture_ms": int(metrics.get("capture", 0)),
                            "processing_ms": int(metrics.get("processing", 0)),
                            "injection_ms": int(metrics.get("injection", 0))
                        }
                    })

                    logger.info(f"[PERF] Refine instruction complete - Total: {metrics.get('total', 0):.0f}ms")

                    # Log to history database (SPEC_029)
                    if self.history_manager:
                        try:
                            self.history_manager.log_session({
                                'mode': 'refine',
                                'transcriber_model': getattr(self.transcriber, 'model_size', 'unknown'),
                                'processor_model': getattr(self.processor, 'model', 'unknown') if self.processor else 'none',
                                'raw_text': instruction,
                                'processed_text': refined_text,
                                'audio_duration_s': audio_duration if 'audio_duration' in locals() else None,
                                'transcription_time_ms': metrics.get('transcription', 0),
                                'processing_time_ms': metrics.get('processing', 0),
                                'total_time_ms': metrics.get('total', 0),
                                'success': True,
                                'error_message': None
                            })
                        except Exception as e:
                            logger.warning(f"[HISTORY] Failed to log refine session: {e}")

                    # Capture system metrics after successful refine (Phase 2)
                    self._capture_system_metrics('post_recording')

                except Exception as e:
                    logger.error(f"[REFINE-INST] Processing failed: {e}")
                    self.perf.end("processing")
                    self._emit_event("refine-instruction-error", {
                        "success": False,
                        "error": f"Processing failed: {str(e)}",
                        "code": "PROCESSING_FAILED"
                    })
            else:
                logger.error("[REFINE-INST] No processor available")
                self._emit_event("refine-instruction-error", {
                    "success": False,
                    "error": "No LLM processor available",
                    "code": "NO_PROCESSOR"
                })

            # Cleanup
            if self.audio_file:
                try:
                    os.remove(self.audio_file)
                except Exception as e:
                    logger.warning(f"Failed to delete temporary audio file: {e}")

            self._set_state(State.IDLE)

        except Exception as e:
            logger.error(sanitize_log_message(f"Refine instruction pipeline error: {e}"))
            self._emit_event("refine-instruction-error", {
                "success": False,
                "error": str(e),
                "code": "UNEXPECTED_ERROR"
            })

            # Log error to history database (SPEC_029)
            if self.history_manager:
                try:
                    self.history_manager.log_session({
                        'mode': 'refine',
                        'transcriber_model': getattr(self.transcriber, 'model_size', 'unknown'),
                        'processor_model': getattr(self.processor, 'model', 'unknown') if self.processor else 'none',
                        'raw_text': None,
                        'processed_text': None,
                        'audio_duration_s': None,
                        'transcription_time_ms': None,
                        'processing_time_ms': None,
                        'total_time_ms': None,
                        'success': False,
                        'error_message': str(e)
                    })
                except Exception as hist_e:
                    logger.warning(f"[HISTORY] Failed to log refine error: {hist_e}")

            self._set_state(State.ERROR)

    def _capture_system_metrics(self, sample_type: str, history_id: Optional[int] = None) -> None:
        """
        Capture system metrics snapshot and log to database.

        Args:
            sample_type: 'post_recording' or 'background_probe'
            history_id: Optional link to history record (for post_recording)
        """
        if not self.history_manager or not self.system_monitor:
            return

        try:
            # Get system snapshot from SystemMonitor
            snapshot = self.system_monitor.get_snapshot()

            # Get Ollama status
            from utils.history_manager import get_ollama_status
            ollama_status = get_ollama_status()

            # Log metrics
            self.history_manager.log_system_metrics({
                'sample_type': sample_type,
                'history_id': history_id,
                'cpu_percent': snapshot.get('cpu_percent'),
                'memory_percent': snapshot.get('memory_percent'),
                'memory_used_gb': snapshot.get('memory_used_gb'),
                'gpu_memory_used_gb': snapshot.get('gpu_memory_used_gb'),
                'gpu_memory_percent': snapshot.get('gpu_memory_percent'),
                'ollama_model_loaded': ollama_status.get('model_name'),
                'ollama_vram_gb': ollama_status.get('vram_gb'),
                'ollama_processor': ollama_status.get('processor'),
                'ollama_unload_minutes': ollama_status.get('unload_minutes')
            })

            logger.debug(f"[METRICS] Captured {sample_type} system metrics")

        except Exception as e:
            logger.warning(f"[METRICS] Failed to capture metrics: {e}")

    def check_health(self) -> dict:
        """Check health of the current processor/model (A.1)"""
        if not self.processor:
            return {"status": "error", "message": "No processor initialized"}

        try:
            # Check if processor has a health check or verification method
            if hasattr(self.processor, "_verify_ollama"):
                # Local processor (Ollama)
                try:
                    import requests
                    response = requests.get(f"{self.processor.ollama_url}/api/tags", timeout=2)
                    if response.status_code == 200:
                        return {"status": "ok", "model": getattr(self.processor, "model", "local"), "provider": "ollama"}
                    else:
                        return {"status": "error", "message": f"Ollama status {response.status_code}"}
                except Exception as e:
                    return {"status": "error", "message": f"Ollama unreachable: {e}"}
            
            elif hasattr(self.processor, "api_key"):
                # Cloud processor - check if API key is present
                if self.processor.api_key:
                    return {"status": "ok", "message": "Cloud provider configured", "provider": "cloud"}
                else:
                    return {"status": "error", "message": "Missing API key"}
            
            return {"status": "ok", "message": "Processor ready (no health check available)"}
            
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def configure(self, config: dict) -> dict:
        """Configure the pipeline (switch models, modes, providers, etc)"""
        try:
            # Store config for use in injection logic
            self.config = config

            updates = []

            # 1. Transcriber Model
            model_size = config.get("model")
            if model_size:
                logger.info(f"[CONFIG] Switching transcription model to: {model_size}")
                self.transcriber = Transcriber(model_size=model_size, device="auto")
                updates.append(f"Model: {model_size}")

            # 2. Provider (local/cloud/anthropic/openai) - Hot-swap processor
            provider = config.get("provider")
            api_key = config.get("apiKey")
            if provider:
                logger.info(f"[CONFIG] Switching provider to: {provider}")
                # Set env var for factory, then recreate processor
                os.environ["PROCESSING_MODE"] = provider

                # Set API key in environment if provided
                if api_key:
                    if provider in ("cloud", "gemini"):
                        os.environ["GEMINI_API_KEY"] = api_key
                        logger.info("[CONFIG] Gemini API key set from secure storage")
                    elif provider == "anthropic":
                        os.environ["ANTHROPIC_API_KEY"] = api_key
                        logger.info("[CONFIG] Anthropic API key set from secure storage")
                    elif provider == "openai":
                        os.environ["OPENAI_API_KEY"] = api_key
                        logger.info("[CONFIG] OpenAI API key set from secure storage")

                try:
                    self.processor = create_processor()
                    updates.append(f"Provider: {provider}")
                except Exception as e:
                    logger.error(f"Failed to switch provider to {provider}: {e}")
                    # Fall back to local
                    os.environ["PROCESSING_MODE"] = "local"
                    self.processor = create_processor()
                    return {"success": False, "error": f"Provider switch failed: {e}. Reverted to local."}

            # 3. Processor Mode (Standard, Prompt, Professional, Raw)
            mode = config.get("mode")
            if mode and self.processor:
                logger.info(f"[CONFIG] Switching processing mode to: {mode}")
                self.current_mode = mode  # Track for raw bypass

                # Check if custom prompt exists for this mode
                custom_prompt = self.custom_prompts.get(mode)
                if custom_prompt:
                    # Use custom prompt (overrides default mode prompt)
                    logger.info(f"[CONFIG] Applying custom prompt for mode: {mode} ({len(custom_prompt)} chars)")
                    if hasattr(self.processor, "prompt"):
                        self.processor.prompt = custom_prompt
                        updates.append(f"Mode: {mode} (custom prompt)")
                    else:
                        logger.warning("Processor does not support custom prompts (no .prompt attribute)")
                else:
                    # Use default mode prompt
                    if hasattr(self.processor, "set_mode"):
                        self.processor.set_mode(mode)
                        updates.append(f"Mode: {mode}")
                    else:
                        logger.warning(f"Processor {type(self.processor)} does not support mode switching")

            # 3b. Custom Prompts (store for later use)
            custom_prompts = config.get("customPrompts")
            if custom_prompts is not None:
                # Filter out empty prompts (empty = use default)
                filtered_prompts = {k: v for k, v in custom_prompts.items() if v}
                self.custom_prompts = filtered_prompts
                prompt_count = len(filtered_prompts)
                logger.info(f"[CONFIG] Custom prompts updated: {prompt_count} custom, {4 - prompt_count} default")
                if prompt_count > 0:
                    logger.info(f"[CONFIG] Custom modes: {list(filtered_prompts.keys())}")

                # Re-apply current mode's prompt if it was just updated
                if self.current_mode in filtered_prompts and self.processor and hasattr(self.processor, "prompt"):
                    self.processor.prompt = filtered_prompts[self.current_mode]
                    logger.info(f"[CONFIG] Re-applied custom prompt for current mode: {self.current_mode}")

            # 4. Translation Mode (none, es-en, en-es)
            trans_mode = config.get("transMode")
            if trans_mode is not None:
                logger.info(f"[CONFIG] Switching translation mode to: {trans_mode}")
                self.trans_mode = trans_mode
                updates.append(f"Trans: {trans_mode}")

            # 5. Default Ollama Model (for local processing)
            default_model = config.get("defaultModel")
            if default_model and self.processor:
                logger.info(f"[CONFIG] Switching default Ollama model to: {default_model}")
                if hasattr(self.processor, "set_model"):
                    # Set state to WARMUP for visual feedback in UI
                    self._set_state(State.WARMUP)
                    try:
                        self.processor.set_model(default_model)
                        updates.append(f"OllamaModel: {default_model}")
                    finally:
                        self._set_state(State.IDLE)
                else:
                    logger.warning(f"Processor {type(self.processor).__name__} does not support model switching (not LocalProcessor)")

            # 6. Audio Device Label (for mute detection)
            device_label = config.get("audioDeviceLabel")
            if device_label and self.mute_detector:
                logger.info(f"[CONFIG] Updating mute detector device to: {device_label}")
                self.mute_detector.update_device_label(device_label)
                updates.append(f"AudioDevice: {device_label}")

            if updates:
                return {"success": True, "message": f"Updated: {', '.join(updates)}"}
            return {"success": False, "error": "No valid configuration found"}
        except Exception as e:
            logger.error(sanitize_log_message(f"Configuration failed: {e}"))
            return {"success": False, "error": str(e)}

    def handle_command(self, command: dict) -> dict:
        """Handle a command from Electron"""
        try:
            cmd_name = command.get("command")
            cmd_id = command.get("id", "unknown")

            logger.info(f"[CMD] Received command: {cmd_name} (id: {cmd_id})")

            if cmd_name == "start_recording":
                return self.start_recording(
                    device_id=command.get("deviceId"),
                    device_label=command.get("deviceLabel"),
                    mode=command.get("mode", "dictate")
                )
            elif cmd_name == "stop_recording":
                return self.stop_recording()
            elif cmd_name == "status":
                data = {
                    "state": self.state.value,
                    "transcriber": "Unknown",
                    "processor": "Unknown"
                }
                
                if self.transcriber:
                    data["transcriber"] = self.transcriber.model_size.upper()
                
                if self.processor:
                    if hasattr(self.processor, "model"):
                        data["processor"] = self.processor.model.upper()
                    elif hasattr(self.processor, "api_url") and "google" in self.processor.api_url:
                        data["processor"] = "GEMINI FLASH"
                    elif hasattr(self.processor, "api_url") and "anthropic" in self.processor.api_url:
                        data["processor"] = "CLAUDE HAIKU"
                    elif hasattr(self.processor, "api_url") and "openai" in self.processor.api_url:
                        data["processor"] = "GPT-4o-MINI"
                    else:
                        data["processor"] = "LOCAL LLM"
                        
                return {"success": True, "data": data}
            elif cmd_name == "configure":
                return self.configure(command.get("config", {}))
            elif cmd_name == "health_check":
                return self.check_health()
            elif cmd_name == "inject_text":
                text = command.get("text", "")
                if self.injector:
                    self._set_state(State.INJECTING)
                    self.injector.type_text(text)
                    self.last_injected_text = text  # Capture for "Oops" feature
                    self._set_state(State.IDLE)
                    return {"success": True}
                else:
                    return {"success": False, "error": "Injector not initialized"}
            elif cmd_name == "refine_selection":
                # Refine mode: Capture selection, process, paste back
                if self.state not in [State.IDLE, State.ERROR]:
                    return {"success": False, "error": f"Cannot refine in {self.state.value} state"}

                try:
                    self._set_state(State.PROCESSING)
                    self.perf.reset()
                    self.perf.start("total")

                    # 1. Capture selection
                    logger.info("[REFINE] Capturing selection...")
                    self.perf.start("capture")
                    selected_text = self.injector.capture_selection()
                    self.perf.end("capture")

                    if not selected_text:
                        logger.warning("[REFINE] No text selected")
                        self._emit_event("refine-error", {
                            "code": "EMPTY_SELECTION",
                            "message": "No text selected. Please highlight text and try again."
                        })
                        self._set_state(State.IDLE)
                        return {"success": False, "error": "EMPTY_SELECTION"}

                    # 2. Process with refine mode
                    logger.info(f"[REFINE] Processing {len(selected_text)} chars...")
                    self.perf.start("processing")

                    if self.processor:
                        try:
                            # Use refine mode prompt
                            original_prompt = self.processor.prompt
                            self.processor.prompt = get_prompt("refine", model=getattr(self.processor, "model", None))

                            refined_text = self.processor.process(selected_text)

                            # Restore original prompt
                            self.processor.prompt = original_prompt

                            logger.info(f"[REFINE] Refined to {len(refined_text)} chars")
                        except Exception as e:
                            logger.error(f"[REFINE] Processing failed: {e}")
                            self._emit_event("refine-error", {
                                "code": "PROCESSING_FAILED",
                                "message": f"Processing failed: {str(e)}"
                            })
                            self._set_state(State.ERROR)
                            return {"success": False, "error": str(e)}
                    else:
                        logger.error("[REFINE] No processor available")
                        self._emit_event("refine-error", {
                            "code": "NO_PROCESSOR",
                            "message": "No processor available"
                        })
                        self._set_state(State.ERROR)
                        return {"success": False, "error": "No processor available"}

                    self.perf.end("processing")

                    # 3. Inject refined text
                    self._set_state(State.INJECTING)
                    logger.info("[REFINE] Injecting refined text...")
                    self.perf.start("injection")

                    # Configure trailing space behavior (if config available)
                    if hasattr(self, 'config') and self.config:
                        trailing_space_enabled = self.config.get('trailingSpaceEnabled', True)
                        self.injector.add_trailing_space = trailing_space_enabled
                        if not trailing_space_enabled:
                            logger.debug("[REFINE] Trailing space disabled for this injection")

                    self.injector.paste_text(refined_text)
                    self.last_injected_text = refined_text  # Capture for "Oops" feature

                    # Optional Additional Key: Press Enter/Tab after paste (if configured)
                    if hasattr(self, 'config') and self.config:
                        additional_key_enabled = self.config.get('additionalKeyEnabled', False)
                        additional_key = self.config.get('additionalKey', 'none')

                        if additional_key_enabled and additional_key and additional_key != 'none':
                            # Safety delay: Wait for paste to complete before pressing additional key
                            time.sleep(0.1)  # 100ms delay

                            try:
                                self.injector.press_key(additional_key)
                                logger.info(f"[REFINE] Additional Key: Pressed '{additional_key}' after paste + space")
                            except Exception as e:
                                logger.error(f"[REFINE] Additional key press failed: {e}")
                                # Non-fatal: Continue even if key press fails

                    self.perf.end("injection")

                    # 4. Emit success
                    self.perf.end("total")
                    metrics = self.perf.get_metrics()
                    metrics["charCount"] = len(refined_text)

                    logger.info(f"[REFINE] Success - Total: {metrics.get('total', 0):.0f}ms")
                    self._emit_event("refine-success", metrics)

                    self._set_state(State.IDLE)
                    return {"success": True, "metrics": metrics}

                except Exception as e:
                    logger.error(f"[REFINE] Unexpected error: {e}")
                    self._emit_event("refine-error", {
                        "code": "UNEXPECTED_ERROR",
                        "message": str(e)
                    })
                    self._set_state(State.ERROR)
                    return {"success": False, "error": str(e)}
            elif cmd_name == "inject_last":
                # "Oops" feature - re-inject last successfully injected text
                if self.last_injected_text:
                    logger.info(f"[INJECT_LAST] Re-injecting {len(self.last_injected_text)} chars")
                    if self.injector:
                        self._set_state(State.INJECTING)
                        self.injector.type_text(self.last_injected_text)
                        self._set_state(State.IDLE)
                        return {"success": True, "char_count": len(self.last_injected_text)}
                    else:
                        return {"success": False, "error": "Injector not initialized"}
                else:
                    logger.info("[INJECT_LAST] No text history available")
                    return {"success": False, "error": "No text to re-inject"}
            elif cmd_name == "shutdown":
                logger.info("[CMD] Shutdown requested")
                return {"success": True}
            else:
                return {"success": False, "error": f"Unknown command: {cmd_name}"}

        except Exception as e:
            logger.error(sanitize_log_message(f"Error handling command: {e}"))
            return {"success": False, "error": str(e)}

    def _start_parallel_monitoring(self):
        """Start background thread to sample system metrics during activity (SPEC_027)"""
        self.should_monitor = True

        def monitor_loop():
            """Background loop that samples metrics every 1 second during activity"""
            while self.should_monitor:
                try:
                    metrics = self.system_monitor.get_snapshot()
                    self._emit_event('system-metrics', {
                        'phase': f'during-{self.state.value}',
                        'activity_count': self.activity_counter,
                        'metrics': metrics
                    })
                except Exception as e:
                    logger.warning(f"[SystemMonitor] Failed to sample metrics: {e}")

                # Sample every 1 second
                time.sleep(1)

        self.monitor_thread = threading.Thread(target=monitor_loop, daemon=True)
        self.monitor_thread.start()
        logger.debug("[SystemMonitor] Parallel monitoring thread started")

    def _stop_parallel_monitoring(self):
        """Stop background monitoring thread (SPEC_027)"""
        self.should_monitor = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=2)
            self.monitor_thread = None
            logger.debug("[SystemMonitor] Parallel monitoring thread stopped")

    def _emit_event(self, event_type: str, data: dict) -> None:
        """Emit an event to Electron"""
        event = {"event": event_type, **data}
        self._send_json(event)

    def _send_error(self, error_msg: str) -> None:
        """Send error event to Electron"""
        self._emit_event("error", {"message": error_msg})

    def _send_json(self, data: dict) -> None:
        """Send JSON data to stdout"""
        try:
            json_str = json.dumps(data)
            print(json_str, flush=True)
        except Exception as e:
            logger.error(f"Failed to send JSON: {e}")

    def _handle_message(self, line: str) -> None:
        """Process a single line (command) from stdin"""
        line = line.strip()
        if not line:
            return

        try:
            command = json.loads(line)
            response = self.handle_command(command)

            # Send response
            response["id"] = command.get("id")
            self._send_json(response)

            # Check for shutdown
            if command.get("command") == "shutdown":
                # This break will be handled by the calling loop
                pass 

        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON received: {e}")
            self._send_error(f"Invalid JSON: {e}")
        except Exception as e:
            logger.error(sanitize_log_message(f"Error processing command: {e}"))
            self._send_error(f"Error: {e}")

    def _start_command_server(self):
        """Start a simple TCP server for external control (Audio Feeder)"""
        def handle_client(conn, addr):
            try:
                # Set a short timeout for the client connection
                conn.settimeout(5.0)
                raw_data = conn.recv(1024).decode().strip()

                # Parse command format: COMMAND:<TOKEN>
                parts = raw_data.split(':', 1)
                command = parts[0].upper()
                token = parts[1] if len(parts) > 1 else ""

                # Log command (without token for security)
                logger.info(f"[CMD] Received external TCP command: {command}")

                # Validate authentication token (SPEC_007)
                if not self.ipc_token:
                    logger.warning(f"[SECURITY] Unauthorized IPC command attempt from {addr} - no token configured")
                    conn.sendall(b"FAIL: AUTH_REQUIRED")
                    return

                if token != self.ipc_token:
                    logger.warning(f"[SECURITY] Unauthorized IPC command attempt from {addr} - invalid token")
                    conn.sendall(b"FAIL: INVALID_TOKEN")
                    return

                # Authentication successful
                logger.debug(f"[SECURITY] Authenticated IPC command from {addr}")

                if command == "START":
                    # For stress testing, make this robust:
                    # 1. If PROCESSING or INJECTING, reject (client should poll for IDLE first)
                    if self.state in (State.PROCESSING, State.INJECTING):
                        error_msg = f"Cannot start while {self.state.value} - wait for IDLE"
                        logger.warning(f"[CMD] TCP START rejected: {error_msg}")
                        conn.sendall(f"BUSY: {self.state.value}".encode())
                        return

                    # 2. If RECORDING, Force STOP then Restart.
                    if self.state == State.RECORDING:
                        logger.warning("[CMD] TCP START received while RECORDING. Forcing RESTART of session.")
                        self.stop_recording()
                        # Give it a moment for cleanup
                        time.sleep(0.2)

                    res = self.start_recording(mode="dictate")
                    if res.get("success"):
                        conn.sendall(b"OK")
                    else:
                        error_msg = res.get("error", "Unknown error")
                        logger.error(f"[CMD] TCP START failed: {error_msg}")
                        conn.sendall(f"FAIL: {error_msg}".encode())
                    
                elif command == "STOP":
                    res = self.stop_recording()
                    if res.get("success"):
                        conn.sendall(b"OK")
                    else:
                        error_msg = res.get("error", "Unknown error")
                        logger.error(f"[CMD] TCP STOP failed: {error_msg}")
                        conn.sendall(f"FAIL: {error_msg}".encode())
                
                elif command == "STATUS":
                    conn.sendall(self.state.value.encode())
                    
                elif command == "PING":
                    conn.sendall(b"PONG")

                elif command == "RESET":
                    # Emergency reset - force app back to IDLE state
                    logger.warning("[CMD] RESET command received - forcing state to IDLE")
                    if self.state == State.RECORDING and self.recording:
                        try:
                            self.recorder.stop()
                            self.recording = False
                        except:
                            pass
                    self._set_state(State.IDLE)
                    conn.sendall(b"OK")

                else:
                    logger.warning(f"[CMD] Unknown TCP command: {command}")
                    conn.sendall(b"UNKNOWN")
            except Exception as e:
                logger.error(f"[CMD] Error handling TCP client: {e}")
            finally:
                conn.close()

        def server_loop():
            host = '127.0.0.1'
            port = 5005
            server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            # Allow reuse
            server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            
            try:
                server.bind((host, port))
                server.listen(1)
                logger.info(f"[CMD] Command server listening on {host}:{port}")
                
                while True: # Daemon thread, will die with main
                    try:
                        conn, addr = server.accept()
                        t = threading.Thread(target=handle_client, args=(conn, addr))
                        t.daemon = True
                        t.start()
                    except Exception as e:
                        logger.error(f"[CMD] Accept error: {e}")
            except Exception as e:
                logger.error(f"[CMD] Failed to bind command server: {e}")

        t = threading.Thread(target=server_loop, daemon=True)
        t.start()

    def start(self):
        """Start the IPC server and begin mute monitoring."""
        # Start the external command server
        self._start_command_server()

        # Start mute monitoring
        self._start_mute_monitoring()

        logger.info("Starting IPC server...")
        print(json.dumps({"type": "ready"}))
        sys.stdout.flush()

        while True:
            try:
                # Read line from stdin (blocking)
                line = sys.stdin.readline()
                if not line:
                    break
                
                self._handle_message(line)
            except KeyboardInterrupt:
                break
            except Exception as e:
                logger.error(f"Error in main loop: {e}")
        
        self.shutdown()

    def shutdown(self) -> None:
        """Clean up and shutdown"""
        logger.info("Shutting down IPC Server...")

        # Log session summary (A.2)
        summary = self.session_stats.get_summary()
        logger.info("=" * 60)
        logger.info("[SESSION SUMMARY]")
        logger.info(f"  Dictations: {summary['dictations']} ({summary['successes']} success, {summary['errors']} errors)")
        logger.info(f"  Total Chars: {summary['total_chars']}")
        logger.info(f"  Avg Time: {summary['avg_time_ms']:.0f}ms")
        logger.info(f"  Session Duration: {summary['session_duration_s']:.1f}s")
        logger.info("=" * 60)

        if self.recording and self.recorder:
            try:
                self.recorder.stop()
            except Exception as e:
                logger.warning(f"Error stopping recorder: {e}")

        if hasattr(self, 'listener') and self.listener:
            self.listener.stop()

        # Gracefully shutdown history manager (SPEC_029)
        if self.history_manager:
            try:
                self.history_manager.shutdown()
            except Exception as e:
                logger.warning(f"Error shutting down history manager: {e}")

        logger.info("IPC Server shutdown complete")
        sys.exit(0)


if __name__ == "__main__":
    server = IpcServer()
    server.start()
