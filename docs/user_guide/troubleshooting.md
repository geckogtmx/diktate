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

## Getting Help
If you encounter a bug, please check the [GitHub Issues](https://github.com/your-repo/diktate/issues) page.
