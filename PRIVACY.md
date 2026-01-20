# Privacy Policy

> **Last Updated:** 2026-01-19
> **Version:** 1.0.0

---

## Summary

dIKtate is designed with **privacy-first** principles. Your voice and data stay on your machine.

| What | Where | Retention |
|------|-------|-----------|
| Audio recordings | Temporary local file | Deleted immediately after processing |
| Transcribed text | In-memory only | Never persisted |
| API keys | Encrypted via OS (DPAPI/Keychain) | Until you delete them |
| Performance logs | `~/.diktate/logs/` | Last 10 sessions |

---

## Data Collection

### What We Collect (Local Mode)

1. **Audio recordings** — Captured while you hold the hotkey. Stored temporarily as `./temp_audio/recording.wav`, deleted immediately after transcription.

2. **Performance metrics** — Pipeline timing data (recording, transcription, processing, injection durations). Stored in `~/.diktate/logs/metrics.json`. Contains no personal data.

3. **Session logs** — Timestamped logs for debugging. Transcribed text is **redacted** (only first 20 characters shown). Stored in `~/.diktate/logs/diktate_*.log`. Last 10 sessions kept.

### What We Collect (Cloud Mode)

When using cloud providers (Gemini, Anthropic, OpenAI):

1. **Transcribed text** is sent to the selected cloud API for processing. Subject to that provider's privacy policy.

2. **API keys** are stored locally using OS-native encryption (Windows DPAPI, macOS Keychain). Never transmitted anywhere except to the API provider.

---

## Data Storage Locations

| Data | Location | Encrypted | Auto-Cleanup |
|------|----------|-----------|--------------|
| Audio files | `./temp_audio/` | No | Yes (immediate) |
| Session logs | `~/.diktate/logs/` | No | Yes (10 sessions) |
| Metrics | `~/.diktate/logs/metrics.json` | No | Yes (1000 entries) |
| Settings | `%APPDATA%/diktate/config.json` | No | Manual |
| API keys | `%APPDATA%/diktate/config.json` | Yes (DPAPI) | Manual |

---

## Known Limitations

### Clipboard Exposure (20ms)

During text injection, your dictated text briefly appears on the clipboard (~20ms). This is a technical requirement for fast paste injection. A program actively monitoring your clipboard could theoretically intercept this.

**Mitigation:** We minimize the window to 20ms and immediately restore your original clipboard.

### Debug Mode

If you run with `DEBUG=1`, transcribed text will appear in console output. This is for development only and defeats privacy guarantees.

---

## Third-Party Services

### Local Mode (Default)
- **Ollama** — Runs 100% locally. No data leaves your machine.
- **Faster-Whisper** — Runs 100% locally. No data leaves your machine.

### Cloud Mode (Optional)
- **Google Gemini** — Subject to [Google's Privacy Policy](https://policies.google.com/privacy)
- **Anthropic Claude** — Subject to [Anthropic's Privacy Policy](https://www.anthropic.com/privacy)
- **OpenAI** — Subject to [OpenAI's Privacy Policy](https://openai.com/policies/privacy-policy)

---

## Your Rights

1. **Access** — All your data is stored locally. You can access it directly.

2. **Deletion** — Delete `~/.diktate/` to remove all logs and metrics. Delete settings at `%APPDATA%/diktate/`.

3. **Portability** — Settings are stored as JSON. You can copy them to another machine.

---

## Contact

For privacy inquiries: [dikta.me](https://dikta.me)

---

*This privacy policy applies to dIKtate v1.0.0 and later.*
