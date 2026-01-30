"""
System resource monitoring module for dIKtate.
Provides lightweight CPU, Memory, and GPU metrics for performance analysis.
"""

import psutil
import logging
import subprocess
import re
import os
from datetime import datetime
from typing import Dict, Optional

logger = logging.getLogger(__name__)

try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False


class SystemMonitor:
    """Lightweight system resource monitor."""

    def __init__(self):
        """Initialize monitor. GPU detection is deferred to first snapshot."""
        self._gpu_initialized = False
        self.has_nvidia_gpu = False
        self.gpu_device_count = 0
        self.gpu_device_name = None
        self.gpu_total_memory = 0
        self._nvidia_smi_path = self._find_nvidia_smi()

    def _find_nvidia_smi(self) -> Optional[str]:
        """Find the nvidia-smi executable on Windows/Linux."""
        if os.name == 'nt':
            # Common Windows locations
            paths = [
                os.environ.get('WINDIR', 'C:\\Windows') + '\\System32\\nvidia-smi.exe',
                os.environ.get('ProgramFiles', 'C:\\Program Files') + '\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe'
            ]
            for p in paths:
                if os.path.exists(p):
                    return p
        # Check if in PATH
        try:
            subprocess.run(['nvidia-smi', '--version'], capture_output=True, check=True)
            return 'nvidia-smi'
        except (subprocess.SubprocessError, FileNotFoundError):
            return None

    def _initialize_gpu(self) -> None:
        """Lazy-initialize GPU detection on first snapshot (allows CUDA to fully initialize)."""
        if self._gpu_initialized:
            return

        self._gpu_initialized = True
        
        if not TORCH_AVAILABLE:
            logger.debug("[SystemMonitor] Torch not found - relying on nvidia-smi for GPU detection")
            if self._nvidia_smi_path:
                self.has_nvidia_gpu = True
            return

        self.has_nvidia_gpu = torch.cuda.is_available()

        if self.has_nvidia_gpu:
            try:
                self.gpu_device_count = torch.cuda.device_count()
                self.gpu_device_name = torch.cuda.get_device_name(0) if self.gpu_device_count > 0 else "Unknown"
                # Get total GPU memory in GB
                self.gpu_total_memory = torch.cuda.get_device_properties(0).total_memory / (1024**3) if self.gpu_device_count > 0 else 0
                logger.info(f"[SystemMonitor] Detected GPU: {self.gpu_device_name} ({self.gpu_total_memory:.2f} GB)")
            except Exception as e:
                logger.warning(f"[SystemMonitor] GPU detection failed: {e}")
                self.has_nvidia_gpu = False
                self.gpu_device_count = 0
                self.gpu_device_name = None
                self.gpu_total_memory = 0
        else:
            if self._nvidia_smi_path:
                logger.info("[SystemMonitor] CUDA available via nvidia-smi but not Torch")
                self.has_nvidia_gpu = True
            else:
                logger.info("[SystemMonitor] CUDA not found - running in CPU mode")

    def _get_gpu_metrics_smi(self) -> Dict[str, Optional[float]]:
        """Get GPU metrics using nvidia-smi (sees all VRAM usage, not just Torch)."""
        if not self._nvidia_smi_path:
            return {'used': None, 'total': None, 'percent': None}

        try:
            result = subprocess.run(
                [self._nvidia_smi_path, '--query-gpu=memory.used,memory.total', '--format=csv,noheader,nounits'],
                capture_output=True,
                text=True,
                timeout=1.0
            )
            if result.returncode == 0:
                parts = result.stdout.strip().split(',')
                if len(parts) >= 2:
                    used_mb = float(parts[0].strip())
                    total_mb = float(parts[1].strip())
                    return {
                        'used': used_mb / 1024.0,
                        'total': total_mb / 1024.0,
                        'percent': (used_mb / total_mb) * 100.0 if total_mb > 0 else 0.0
                    }
        except Exception as e:
            logger.debug(f"[SystemMonitor] nvidia-smi call failed: {e}")
        
        return {'used': None, 'total': None, 'percent': None}

    def get_snapshot(self) -> Dict:
        """
        Get a single point-in-time snapshot of system resources.

        Returns:
            Dictionary with CPU, memory, and GPU metrics
        """
        # Lazy-initialize GPU detection on first call (allows CUDA to fully init)
        self._initialize_gpu()

        # CPU metrics
        cpu_percent = psutil.cpu_percent(interval=0.1)

        # Memory metrics
        memory = psutil.virtual_memory()
        memory_percent = memory.percent
        memory_used_gb = memory.used / (1024**3)
        memory_total_gb = memory.total / (1024**3)

        # GPU metrics (if available)
        gpu_memory_used_gb: Optional[float] = None
        gpu_memory_total_gb: Optional[float] = None
        gpu_memory_percent: Optional[float] = None

        if self.has_nvidia_gpu:
            # Try nvidia-smi first for real-world system VRAM usage (SPEC_035 requested)
            smi_metrics = self._get_gpu_metrics_smi()
            if smi_metrics['used'] is not None:
                gpu_memory_used_gb = smi_metrics['used']
                gpu_memory_total_gb = smi_metrics['total']
                gpu_memory_percent = smi_metrics['percent']
            elif TORCH_AVAILABLE and torch.cuda.is_available():
                # Fallback to Torch (only sees Torch allocations)
                try:
                    gpu_memory_allocated = torch.cuda.memory_allocated(0)
                    gpu_memory_used_gb = gpu_memory_allocated / (1024**3)
                    gpu_memory_total_gb = self.gpu_total_memory
                    if gpu_memory_total_gb > 0:
                        gpu_memory_percent = (gpu_memory_used_gb / gpu_memory_total_gb) * 100
                    else:
                        gpu_memory_percent = 0.0
                except Exception as e:
                    logger.debug(f"[SystemMonitor] Torch GPU metrics failed: {e}")

        return {
            # CPU
            'cpu_percent': round(cpu_percent, 1),

            # Memory
            'memory_percent': round(memory_percent, 1),
            'memory_used_gb': round(memory_used_gb, 2),
            'memory_total_gb': round(memory_total_gb, 2),

            # GPU
            'gpu_available': self.has_nvidia_gpu,
            'gpu_device_name': self.gpu_device_name or "NVIDIA GPU",
            'gpu_memory_used_gb': round(gpu_memory_used_gb, 2) if gpu_memory_used_gb is not None else None,
            'gpu_memory_total_gb': round(gpu_memory_total_gb, 2) if gpu_memory_total_gb is not None else None,
            'gpu_memory_percent': round(gpu_memory_percent, 1) if gpu_memory_percent is not None else None,

            # Timestamp
            'timestamp': datetime.utcnow().isoformat() + 'Z'
        }

    def get_summary(self) -> str:
        """
        Get a human-readable summary of system configuration.

        Returns:
            String summary of CPU, memory, and GPU
        """
        snapshot = self.get_snapshot()

        summary = [
            f"CPU: {snapshot['cpu_percent']}%",
            f"Memory: {snapshot['memory_used_gb']}/{snapshot['memory_total_gb']} GB ({snapshot['memory_percent']}%)"
        ]

        if snapshot['gpu_available']:
            summary.append(
                f"GPU: {snapshot['gpu_device_name']} - "
                f"{snapshot['gpu_memory_used_gb'] if snapshot['gpu_memory_used_gb'] is not None else '?'}/"
                f"{snapshot['gpu_memory_total_gb'] if snapshot['gpu_memory_total_gb'] is not None else '?'} GB "
                f"({snapshot['gpu_memory_percent'] if snapshot['gpu_memory_percent'] is not None else '?'}%)"
            )
        else:
            summary.append("GPU: Not available (CPU mode)")

        return " | ".join(summary)
