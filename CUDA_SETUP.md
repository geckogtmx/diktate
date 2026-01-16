# CUDA Setup Guide

## Current Status
- PyTorch installed with CPU-only support
- CUDA is NOT currently available
- System has no compatible NVIDIA GPU detected

## Options

### Option 1: Install CUDA (If you have NVIDIA GPU)
If your system has an NVIDIA GPU:

1. Check GPU: `nvidia-smi`
2. Install CUDA Toolkit from: https://developer.nvidia.com/cuda-downloads
3. Install cuDNN from: https://developer.nvidia.com/cudnn
4. Reinstall PyTorch with CUDA:
   ```bash
   cd python && source venv/Scripts/activate
   pip uninstall torch torchvision
   pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
   ```

### Option 2: Continue with CPU Mode
The system will work fine with CPU, but inference will be slower:
- Whisper medium: ~15-30 seconds per 5-second audio (vs ~2-3 seconds with GPU)
- Text processing: ~5-10 seconds per request

## Performance Impact
- **GPU (NVIDIA A100/3060)**: 15 seconds E2E (target)
- **GPU (GTX 1080)**: 20-25 seconds E2E
- **CPU (modern i7/Ryzen)**: 60-90 seconds E2E

## Verification
To check your current setup:
```bash
cd python && source venv/Scripts/activate
python -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}')"
```

## Notes
- CPU fallback is acceptable for MVP
- Can optimize GPU support later
- Whisper model will be downloaded on first run (~3.1 GB for medium)
