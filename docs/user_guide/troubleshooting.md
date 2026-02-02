# Troubleshooting

## Common Issues

### Nothing happens when I press the hotkey
- Check if dIKtate is running in the system tray.
- Ensure no other application is blocking `Ctrl+Alt+D`.
- Try restarting the application.

### "Dictionary error" or Transcription fails
- Ensure **Ollama** is running (`ollama serve` in a terminal).
- Verify you have the correct model pulled: `ollama pull gemma3:4b`.

### Transcription is slow
- The first run after startup is slower due to "warm-up". Subsequent runs should be faster.
- Performance depends on your CPU/GPU. Ensure you are using a modern machine.

## FAQ: Local vs Cloud Models

### Why can't I use different Ollama models for different modes?
**Answer:** dIKtate uses a single Ollama model across all modes to prevent VRAM contention. This is a performance optimization called SPEC_038.

**Why?** On GPUs with limited VRAM (8-12GB):
- Multiple models loaded simultaneously compete for memory
- This causes constant model eviction and reloading (2.6s penalty per switch)
- Results in 5-7x slower processing (2500-3800ms vs 300-500ms with a single warm model)

**What changed?**
- ✅ **Before**: Could assign `gemma3:4b` to Standard mode and `llama3:8b` to Professional mode
- ⚠️ **Now**: All local modes use the same Ollama model (set in Settings → Default Model)
- ✅ **Still works**: Per-mode custom prompts (can customize output style per mode without changing the model)

### Cloud providers can still use different models per mode
Google Gemini, Anthropic Claude, and OpenAI GPT-4 still support per-mode model selection because:
- Models are loaded on the provider's infrastructure (no local VRAM constraint)
- Each request is stateless (no performance penalty for switching)

### Where can I change my local model?
**Settings → General → Default Model** - You must select ONE model from your installed Ollama models. This model is used for ALL local modes (Standard, Professional, Ask, Refine, etc.)

**Important:** You must have at least one Ollama model installed and selected before using local processing. If you haven't selected a model, you'll see an error prompting you to do so.

### How do I optimize my model selection?
- **Limited VRAM (8GB)**: Use `gemma3:1b` or `gemma3:4b` (smaller, faster)
- **Medium VRAM (12GB)**: Use `gemma3:4b` or `llama3:8b` (balanced)
- **High VRAM (16GB+)**: Use larger models like `llama2:13b` (better quality, slower)


## Getting Help
If you encounter a bug, please check the [GitHub Issues](https://github.com/your-repo/diktate/issues) page.
