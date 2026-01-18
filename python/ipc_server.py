"""
IPC Server for dIKtate
Handles JSON-based communication between Electron and Python backend
"""

import sys
import json
import threading
import logging
import time
from enum import Enum
from pathlib import Path
from typing import Optional, Dict
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
from config.prompts import get_translation_prompt
from utils.security import redact_text, sanitize_log_message

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


class State(Enum):
    """Pipeline states"""
    IDLE = "idle"
    RECORDING = "recording"
    PROCESSING = "processing"
    INJECTING = "injecting"
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


class IpcServer:
    """Server for handling IPC commands from Electron"""

    def __init__(self):
        """Initialize the IPC server"""
        self.state = State.IDLE
        self.recorder: Optional[Recorder] = None
        self.transcriber: Optional[Transcriber] = None
        self.processor: Optional[Processor] = None
        self.injector: Optional[Injector] = None
        self.recording = False
        self.audio_file = None
        self.perf = PerformanceMetrics()
        self.session_stats = SessionStats()  # Session-level stats (A.2)
        self.trans_mode = "none"  # Translation mode: none, es-en, en-es

        logger.info("Initializing IPC Server...")
        self._initialize_components()
        logger.info("IPC Server initialized successfully")

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
        logger.info(f"State transition: {self.state.value} -> {new_state.value}")
        self.state = new_state
        self._emit_event("state-change", {"state": new_state.value})

    def start_recording(self, device_id: Optional[str] = None, device_label: Optional[str] = None) -> dict:
        """Start recording audio"""
        if self.state != State.IDLE:
            error_msg = f"Cannot start recording in {self.state.value} state"
            logger.warning(error_msg)
            return {"success": False, "error": error_msg}

        try:
            # Reset metrics for new session
            self.perf.reset()
            self.perf.start("total")
            self.perf.start("recording")

            self._set_state(State.RECORDING)
            self.recorder.start(device_id=device_id, device_label=device_label)
            self.recording = True
            logger.info("[REC] Recording started")
            return {"success": True}
        except Exception as e:
            logger.error(sanitize_log_message(f"Failed to start recording: {e}"))
            self._set_state(State.ERROR)
            return {"success": False, "error": str(e)}

    def stop_recording(self) -> dict:
        """Stop recording and process the audio"""
        if self.state != State.RECORDING:
            error_msg = f"Cannot stop recording in {self.state.value} state"
            logger.warning(error_msg)
            return {"success": False, "error": error_msg}

        self.recording = False
        try:
            self.recorder.stop()
            self.perf.end("recording")
            logger.info("[STOP] Recording stopped")

            # Save audio to temporary file
            import os
            self.audio_file = os.path.join(self.recorder.temp_dir, "recording.wav")
            self.recorder.save_to_file(self.audio_file)

            # Process the recording in a background thread
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

            # Log audio file metadata (A.2 observability)
            if self.audio_file:
                try:
                    import wave
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

            # Transcribe
            logger.info("[TRANSCRIBE] Transcribing audio...")
            self.perf.start("transcription")
            raw_text = self.transcriber.transcribe(self.audio_file)
            self.perf.end("transcription")
            logger.info(f"[RESULT] Transcribed: {redact_text(raw_text)}")

            if not raw_text or not raw_text.strip():
                logger.info("[PROCESS] Empty transcription, skipping processing and injection")
                self._set_state(State.IDLE)
                return

            # Process (clean up text)
            logger.info("[PROCESS] Processing text...")
            self.perf.start("processing")
            if self.processor:
                processed_text = self.processor.process(raw_text)
            else:
                processed_text = raw_text
            self.perf.end("processing")
            logger.info(f"[RESULT] Processed: {redact_text(processed_text)}")

            # Optional: Translate (post-processing)
            if self.trans_mode and self.trans_mode != "none":
                trans_prompt = get_translation_prompt(self.trans_mode)
                if trans_prompt and self.processor:
                    logger.info(f"[TRANSLATE] Translating ({self.trans_mode})...")
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
            self.injector.type_text(processed_text)
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

            # Cleanup
            if self.audio_file:
                try:
                    import os
                    os.remove(self.audio_file)
                except Exception as e:
                    logger.warning(f"Failed to delete temporary audio file: {e}")

            self._set_state(State.IDLE)

        except Exception as e:
            logger.error(sanitize_log_message(f"Pipeline error: {e}"))
            self.session_stats.record_error()  # Track errors (A.2)
            self._set_state(State.ERROR)

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
                if hasattr(self.processor, "set_mode"):
                    self.processor.set_mode(mode)
                    updates.append(f"Mode: {mode}")
                else:
                    logger.warning(f"Processor {type(self.processor)} does not support mode switching")

            # 4. Translation Mode (none, es-en, en-es)
            trans_mode = config.get("transMode")
            if trans_mode is not None:
                logger.info(f"[CONFIG] Switching translation mode to: {trans_mode}")
                self.trans_mode = trans_mode
                updates.append(f"Trans: {trans_mode}")

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
                    device_label=command.get("deviceLabel")
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
            elif cmd_name == "shutdown":
                logger.info("[CMD] Shutdown requested")
                return {"success": True}
            else:
                return {"success": False, "error": f"Unknown command: {cmd_name}"}

        except Exception as e:
            logger.error(sanitize_log_message(f"Error handling command: {e}"))
            return {"success": False, "error": str(e)}

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

    def run(self) -> None:
        """Run the IPC server"""
        try:
            logger.info("=" * 60)
            logger.info("dIKtate IPC Server is running")
            logger.info("Waiting for commands from Electron...")
            logger.info("=" * 60)

            # Read commands from stdin
            for line in sys.stdin:
                line = line.strip()
                if not line:
                    continue

                try:
                    command = json.loads(line)
                    response = self.handle_command(command)

                    # Send response
                    response["id"] = command.get("id")
                    self._send_json(response)

                    # Check for shutdown
                    if command.get("command") == "shutdown":
                        break

                except json.JSONDecodeError as e:
                    logger.error(f"Invalid JSON received: {e}")
                    self._send_error(f"Invalid JSON: {e}")
                except Exception as e:
                    logger.error(sanitize_log_message(f"Error processing command: {e}"))
                    self._send_error(f"Error: {e}")

        except KeyboardInterrupt:
            logger.info("Received keyboard interrupt, shutting down...")
        except Exception as e:
            logger.error(f"Runtime error: {e}")
        finally:
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

        logger.info("IPC Server shutdown complete")
        sys.exit(0)


if __name__ == "__main__":
    server = IpcServer()
    server.run()
