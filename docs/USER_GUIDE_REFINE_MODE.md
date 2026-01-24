# Refine Mode User Guide

> **Feature:** AI-Powered In-Place Text Editing
> **Hotkey:** `Ctrl+Alt+R` (customizable)
> **Status:** Ready for Implementation

---

## What is Refine Mode?

Refine Mode lets you improve any selected text with AI, right where you're working. No copy-paste needed—just highlight, press a hotkey, and watch your text get polished instantly.

---

## How to Use

### Basic Workflow

1. **Select Text**
   Highlight the text you want to improve in any application (Word, Gmail, Slack, etc.)

2. **Press Hotkey**
   Default: `Ctrl+Alt+R`
   You'll hear a sound and see the system tray icon turn blue

3. **Wait**
   The AI will process your text (usually 1-3 seconds)

4. **Done**
   The refined text automatically replaces your selection
   You'll hear a success sound

5. **Undo if Needed**
   Press `Ctrl+Z` to revert if you don't like the result

---

## What It Does

### Improvements

- ✅ Fixes spelling and grammar errors
- ✅ Improves sentence clarity and flow
- ✅ Polishes tone for better readability
- ✅ Corrects punctuation and capitalization

### What It Preserves

- ✅ Your original meaning and intent
- ✅ Technical terms and proper nouns
- ✅ Paragraph structure and line breaks
- ✅ Tone (casual stays casual, formal stays formal)

---

## Examples

### Before Refine

```
thier going to the meeting tomorrow at 3pm dont be late
```

### After Refine

```
They're going to the meeting tomorrow at 3pm. Don't be late.
```

---

### Before Refine

```
The project deadline is approaching we need to finalize the requirements document and
make sure all stakeholders are aligned on the scope and deliverables
```

### After Refine

```
The project deadline is approaching. We need to finalize the requirements document and
ensure all stakeholders are aligned on the scope and deliverables.
```

---

## Where It Works

Refine Mode works in **any application** that supports text selection:

- ✅ Email clients (Outlook, Gmail, Thunderbird)
- ✅ Text editors (Notepad, VSCode, Sublime)
- ✅ Office apps (Word, Excel, PowerPoint)
- ✅ Messaging apps (Slack, Teams, Discord)
- ✅ Browsers (Chrome, Firefox, Edge)
- ✅ Social media (Twitter, LinkedIn, Facebook)

**Note:** Read-only fields (like web articles) will copy the refined text to your clipboard instead of pasting.

---

## Settings

### Change Hotkey

1. Open dIKtate Settings
2. Go to **Hotkeys** section
3. Click on **Refine Hotkey** field
4. Press your desired key combination (e.g., `Ctrl+Shift+R`)
5. Click **Save**

### Choose Processing Model

Refine Mode uses your currently selected LLM:

- **Local Mode** (Default): Uses Ollama with your chosen model (fast, private)
- **Cloud Mode**: Uses Gemini, Claude, or OpenAI (slower, requires internet)

To change: Go to Settings → Processing → Select Model

---

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| **"No text selected"** | You didn't highlight any text | Select text before pressing hotkey |
| **"Processing failed"** | Ollama is not running (local mode) | 1. Open Ollama<br>2. Try again |
| **Slow refinement (>5s)** | Large text or slow model | 1. Select shorter text<br>2. Switch to faster model |
| **Text unchanged** | Text is already perfect | AI decided no changes needed |
| **Weird output** | Model hallucination (rare) | 1. Press Ctrl+Z to undo<br>2. Try again |

---

## Tips & Tricks

### Best Practices

1. **Select 1-3 paragraphs at a time**
   Shorter text = faster processing and better results

2. **Use Ctrl+Z liberally**
   Don't worry about trying it—you can always undo

3. **Try it on rough drafts**
   Perfect for quick emails, Slack messages, or notes

4. **Combine with dictation**
   Dictate first (`Ctrl+Alt+D`), then refine (`Ctrl+Alt+R`)

### Advanced Usage

- **Iterative refinement**: Refine once, then select and refine again for extra polish
- **Context matters**: The AI preserves your tone, so casual text stays casual
- **No internet needed**: Works offline with local models (Ollama)

---

## Privacy & Security

- ✅ **Local processing**: Text never leaves your computer (local mode)
- ✅ **No logging**: Refined text is not stored or logged
- ✅ **Clipboard safety**: Your original clipboard content is preserved

**Note:** Cloud mode sends text to AI provider (Gemini, Claude, OpenAI) for processing.

---

## Keyboard Shortcuts Summary

| Action | Default Hotkey | Customizable? |
|--------|---------------|---------------|
| Refine selected text | `Ctrl+Alt+R` | ✅ Yes |
| Undo refine | `Ctrl+Z` | ❌ OS default |
| Open settings | (via tray icon) | — |

---

## Known Limitations

### v1.0 Limitations

- **Plain text only**: Formatting (bold, italic, colors) is not preserved
- **Long text**: Very large selections (>2000 words) may time out
- **Paste-protected fields**: Some secure password fields block paste

### Future Enhancements

- Preserve rich text formatting (bold, italic, etc.)
- Context-aware modes (code, email, social media)
- Multi-language support (translate while refining)
- Refine presets ("Make Professional", "Simplify")

---

## FAQ

**Q: Does refining cost money?**
A: No, local mode is free. Cloud mode uses your API credits.

**Q: Can I refine code?**
A: Yes, but v1.0 treats it as regular text. Code-specific refinement is planned for v2.0.

**Q: What if I don't like the result?**
A: Press `Ctrl+Z` immediately to undo and restore your original text.

**Q: How is this different from dictation mode?**
A: Dictation (`Ctrl+Alt+D`) transcribes speech. Refine (`Ctrl+Alt+R`) improves existing text.

**Q: Can I refine text in multiple languages?**
A: Yes, the AI can work with most languages. Results depend on your model's language support.

**Q: Does it work offline?**
A: Yes, in local mode with Ollama. Cloud mode requires internet.

---

## Support

Having issues? Here's how to get help:

1. **Check logs**: Settings → View Logs (look for `[REFINE]` entries)
2. **Test with simple text**: Try refining "hello world" to verify it's working
3. **Check Ollama**: Make sure Ollama is running (local mode only)
4. **Report bugs**: Create an issue on GitHub with steps to reproduce

---

**Happy refining! 🚀**
