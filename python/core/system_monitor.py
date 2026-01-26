"""
System resource monitoring module for dIKtate.
Provides lightweight CPU, Memory, and GPU metrics for performance analysis.
"""

import psutil
from datetime import datetime
from typing import Dict, Optional

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

    def _initialize_gpu(self) -> None:
        """Lazy-initialize GPU detection on first snapshot (allows CUDA to fully initialize)."""
        if self._gpu_initialized:
            return

        self._gpu_initialized = True
        self.has_nvidia_gpu = TORCH_AVAILABLE and torch.cuda.is_available()

        if self.has_nvidia_gpu:
            try:
                self.gpu_device_count = torch.cuda.device_count()
                self.gpu_device_name = torch.cuda.get_device_name(0) if self.gpu_device_count > 0 else "Unknown"
                # Get total GPU memory in GB
                self.gpu_total_memory = torch.cuda.get_device_properties(0).total_memory / (1024**3) if self.gpu_device_count > 0 else 0
            except Exception as e:
                print(f"[SystemMonitor] Warning: GPU detection failed: {e}")
                self.has_nvidia_gpu = False
                self.gpu_device_count = 0
                self.gpu_device_name = None
                self.gpu_total_memory = 0

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
            try:
                # Get allocated memory (in bytes), convert to GB
                gpu_memory_allocated = torch.cuda.memory_allocated(0)
                gpu_memory_used_gb = gpu_memory_allocated / (1024**3)
                gpu_memory_total_gb = self.gpu_total_memory

                # Calculate percentage
                if gpu_memory_total_gb > 0:
                    gpu_memory_percent = (gpu_memory_used_gb / gpu_memory_total_gb) * 100
                else:
                    gpu_memory_percent = 0.0

            except Exception as e:
                print(f"[SystemMonitor] Warning: GPU metrics query failed: {e}")
                gpu_memory_used_gb = None
                gpu_memory_total_gb = None
                gpu_memory_percent = None

        return {
            # CPU
            'cpu_percent': round(cpu_percent, 1),

            # Memory
            'memory_percent': round(memory_percent, 1),
            'memory_used_gb': round(memory_used_gb, 2),
            'memory_total_gb': round(memory_total_gb, 2),

            # GPU
            'gpu_available': self.has_nvidia_gpu,
            'gpu_device_name': self.gpu_device_name,
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
                f"{snapshot['gpu_memory_used_gb']}/{snapshot['gpu_memory_total_gb']} GB "
                f"({snapshot['gpu_memory_percent']}%)"
            )
        else:
            summary.append("GPU: Not available (CPU mode)")

        return " | ".join(summary)
