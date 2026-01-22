# dIKtate Self-Testing Tools

These tools allow you to test dIKtate using its own output, creating a self-referential testing loop.

## 🎯 Purpose

Test how well dIKtate handles:
- **Self-reference**: Processing text that talks about dIKtate itself
- **Recursive improvement**: Using processed output as new input
- **Consistency**: Performance across multiple iterations
- **Meta-cognition**: Understanding its own capabilities

## 🛠️ Available Tests

### 1. Manual Self-Test (`self_test_loop.py`)
**Interactive testing with microphone**

**What it does:**
- Displays test prompts for you to read aloud
- Records your voice, transcribes with Whisper
- Processes text with gemma3:4b
- Uses processed output as next test prompt
- Tracks accuracy and performance metrics

**When to use:**
- Testing real-world voice recording
- Evaluating microphone quality
- Manual verification of transcription accuracy

**How to run:**
```bash
run_self_test.bat
# Choose option 1
```

### 2. Automated Self-Test (`automated_self_test.py`)
**Automated testing with synthesized speech**

**What it does:**
- Creates test audio using Windows speech synthesis
- Transcribes and processes automatically
- Tests multiple scenarios without user interaction
- Can run continuously for stress testing

**When to use:**
- Continuous integration testing
- Performance benchmarking
- Stress testing the pipeline

**How to run:**
```bash
run_self_test.bat
# Choose option 2
```

### 3. Meta-Test (`meta_test.py`)
**Self-referential capability testing**

**What it does:**
- Starts with a meta-test prompt about dIKtate
- Creates conversation where each round references previous output
- Tests how well gemma3:4b handles self-reference
- Scores coherence and self-reference handling

**When to use:**
- Testing meta-cognitive capabilities
- Evaluating self-reference processing
- Understanding system limitations

**How to run:**
```bash
run_self_test.bat
# Choose option 3
```

## 📊 Test Results

All tests save results to:
```
C:\Users\gecko\.diktate\logs\
├── selftest_YYYYMMDD_HHMMSS.log
├── automated_selftest_YYYYMMDD_HHMMSS.log
├── meta_test_YYYYMMDD_HHMMSS.log
├── selftest_results_YYYYMMDD_HHMMSS.json
├── automated_selftest_results_YYYYMMDD_HHMMSS.json
├── meta_test_results_YYYYMMDD_HHMMSS.json
└── meta_conversation_YYYYMMDD_HHMMSS.txt
```

### Metrics Tracked

**Performance Metrics:**
- Recording time (manual tests)
- Transcription time (Whisper)
- Processing time (gemma3:4b)
- Total pipeline time

**Quality Metrics:**
- Transcription accuracy (%)
- Processing accuracy (%)
- Self-reference score (0-10)
- Coherence score (0-10)

**Conversation Tracking:**
- Input prompt history
- Processed output history
- Round-by-round progression

## 🔄 Self-Referential Testing

The meta-test specifically evaluates how dIKtate handles:

### Example Conversation Flow

**Round 1:**
```
Input: "I am testing dIKtate's ability to process its own output."
Output: "I'm testing dIKtate's ability to process its own output."
```

**Round 2:**
```
Input: "Round 2. The previous output was about testing dIKtate. Now testing self-reference."
Output: "In round 2, I'm testing how dIKtate handles self-reference based on previous output."
```

**Round 3:**
```
Input: "Round 3. Building on the self-reference test to see if dIKtate understands meta-context."
Output: "For round 3, I'm evaluating dIKtate's meta-context understanding in self-reference scenarios."
```

### Scenarios Tested

1. **Basic Self-Reference**: Text mentioning "dIKtate"
2. **Meta-Testing**: Text about testing dIKtate
3. **Recursive Context**: Building on previous outputs
4. **Technical Terms**: Processing "gemma3:4b", "Whisper", etc.
5. **Capability Claims**: Text about what dIKtate can do

## 🎯 Use Cases

### Development Testing
```bash
# Quick verification after code changes
run_self_test.bat
# Choose option 2 (automated)
# Set iterations to 3
```

### Performance Benchmarking
```bash
# Stress test for 30 minutes
run_self_test.bat
# Choose option 2
# Set iterations to 180 (30 mins at 10s each)
```

### Meta-Cognitive Evaluation
```bash
# Test self-referential capability
run_self_test.bat
# Choose option 3
# Set rounds to 10
```

### Regression Testing
```bash
# Before/after comparing performance
run_self_test.bat
# Choose option 2
# Save results, make changes, run again
```

## 📈 Expected Results

### Healthy System
- **Transcription accuracy**: >90%
- **Processing accuracy**: >85%
- **Self-reference score**: >7/10
- **Coherence score**: >8/10
- **Total time**: <10s per round

### Warning Signs
- **Declining accuracy**: Model degradation
- **Increasing time**: Performance regression
- **Low self-reference score**: Meta-cognitive limits
- **Inconsistent output**: Model instability

## 🐛 Troubleshooting

### Common Issues

**"Speech synthesis failed"**
- Check Windows audio settings
- Ensure PowerShell execution policy allows scripts
- Try running as administrator

**"Component initialization failed"**
- Check Python environment
- Verify dependencies in requirements.txt
- Ensure Ollama is running

**"Low transcription accuracy"**
- Check microphone quality (manual tests)
- Verify Whisper model is loaded
- Test with clearer audio

### Performance Optimization

**For faster testing:**
- Use smaller Whisper models
- Reduce audio quality in automated tests
- Limit conversation history

**For more accurate testing:**
- Use higher quality audio
- Increase test prompt diversity
- Add more evaluation metrics

## 🔧 Customization

### Adding Test Prompts

Edit the test cases in each script:

```python
# In automated_self_test.py
self.test_cases = [
    {
        "name": "Custom Test",
        "expected": "Expected output",
        "audio_text": "Text to speak"
    }
]
```

### Modifying Evaluation

Add custom metrics in the scoring functions:

```python
def custom_score(self, prompt: str, output: str) -> float:
    # Your custom scoring logic
    return score
```

### Changing Models

Switch to different models in the processor:

```python
# In processor.py
self.model = "different-model"
```

---

**🎯 This creates a complete self-testing ecosystem where dIKtate can validate, improve, and understand its own capabilities through continuous self-reference.**