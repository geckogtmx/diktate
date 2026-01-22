#!/usr/bin/env python3
"""
Automated dIKtate Self-Testing Loop

This script creates an automated self-testing cycle where dIKtate:
1. Uses pre-recorded test audio files
2. Transcribes them using Whisper
3. Processes text with gemma3:4b  
4. Compares output against expected results
5. Logs performance and accuracy metrics
6. Can run continuously for stress testing

Usage: python automated_self_test.py
"""

import os
import sys
import json
import time
import logging
from datetime import datetime
from pathlib import Path
import subprocess
import tempfile
import wave
import numpy as np

# Add the core modules to path
sys.path.append(str(Path(__file__).parent))

from core.transcriber import WhisperTranscriber  
from core.processor import TextProcessor

class AutomatedSelfTest:
    def __init__(self):
        self.setup_logging()
        self.setup_components()
        self.test_cases = self.get_test_cases()
        self.session_results = []
        
    def setup_logging(self):
        """Setup dedicated logging for automated self-test"""
        log_dir = Path("C:/Users/gecko/.diktate/logs")
        log_dir.mkdir(exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_file = log_dir / f"automated_selftest_{timestamp}.log"
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger("AUTO_SELFTEST")
        
    def setup_components(self):
        """Initialize dIKtate components"""
        self.logger.info("Initializing components...")
        
        try:
            self.transcriber = WhisperTranscriber()
            self.processor = TextProcessor()
            self.logger.info("Components initialized successfully")
        except Exception as e:
            self.logger.error(f"Failed to initialize components: {e}")
            raise
            
    def get_test_cases(self):
        """Get test cases with expected outputs"""
        return [
            {
                "name": "Basic Sentence",
                "expected": "This is a test of the dIKtate system.",
                "audio_text": "This is a test of the dIKtate system."
            },
            {
                "name": "Complex Sentence", 
                "expected": "The quick brown fox jumps over the lazy dog.",
                "audio_text": "The quick brown fox jumps over the lazy dog."
            },
            {
                "name": "With Fillers",
                "expected": "Testing the system with proper punctuation.",
                "audio_text": "Testing, um, the system with, uh, proper punctuation."
            },
            {
                "name": "Technical Terms",
                "expected": "The API uses GPU acceleration for faster processing.",
                "audio_text": "The API uses GPU acceleration for faster processing."
            },
            {
                "name": "Self Reference",
                "expected": "dIKtate should process this text with gemma3:4b.",
                "audio_text": "dIKtate should process this text with gemma3:4b."
            }
        ]
        
    def create_test_audio(self, text: str, output_path: str):
        """Create a test audio file from text using Windows speech synthesis"""
        try:
            # Use Windows PowerShell to create speech audio
            ps_script = f'''
Add-Type -AssemblyName System.Speech
$synthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synthesizer.SetOutputToWaveFile("{output_path}")
$synthesizer.Speak("{text}")
$synthesizer.Dispose()
'''
            
            with tempfile.NamedTemporaryFile(mode='w', suffix='.ps1', delete=False) as ps_file:
                ps_file.write(ps_script)
                ps_script_path = ps_file.name
            
            # Execute PowerShell script
            result = subprocess.run(
                ['powershell', '-ExecutionPolicy', 'Bypass', '-File', ps_script_path],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            # Cleanup
            os.unlink(ps_script_path)
            
            if result.returncode != 0:
                self.logger.error(f"Speech synthesis failed: {result.stderr}")
                return False
                
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to create test audio: {e}")
            return False
            
    def run_single_test(self, test_case: dict) -> dict:
        """Run a single automated test"""
        self.logger.info(f"Running test: {test_case['name']}")
        
        result = {
            'timestamp': datetime.now().isoformat(),
            'test_name': test_case['name'],
            'expected': test_case['expected'],
            'original_text': test_case['audio_text']
        }
        
        try:
            # Step 1: Create test audio
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_audio:
                audio_path = temp_audio.name
                
            start_time = time.time()
            self.logger.info("Creating test audio...")
            
            if not self.create_test_audio(test_case['audio_text'], audio_path):
                raise Exception("Failed to create test audio")
                
            audio_time = time.time() - start_time
            result['audio_generation_time'] = audio_time
            
            # Step 2: Transcribe
            transcribe_start = time.time()
            self.logger.info("Transcribing audio...")
            transcribed_text = self.transcriber.transcribe(audio_path)
            transcribe_time = time.time() - transcribe_start
            result['transcription_time'] = transcribe_time
            result['transcribed_text'] = transcribed_text
            self.logger.info(f"Transcribed: {transcribed_text}")
            
            # Step 3: Process with gemma3:4b
            process_start = time.time()
            self.logger.info("Processing with gemma3:4b...")
            processed_text = self.processor.process_text(transcribed_text)
            process_time = time.time() - process_start
            result['processing_time'] = process_time
            result['processed_text'] = processed_text
            self.logger.info(f"Processed: {processed_text}")
            
            # Step 4: Calculate accuracy metrics
            result['transcription_accuracy'] = self.calculate_accuracy(
                test_case['audio_text'], transcribed_text
            )
            result['processing_accuracy'] = self.calculate_accuracy(
                test_case['expected'], processed_text
            )
            result['total_time'] = audio_time + transcribe_time + process_time
            
            self.logger.info(f"Test complete! Total time: {result['total_time']:.2f}s")
            self.logger.info(f"Transcription accuracy: {result['transcription_accuracy']:.1f}%")
            self.logger.info(f"Processing accuracy: {result['processing_accuracy']:.1f}%")
            
        except Exception as e:
            self.logger.error(f"Test failed: {e}")
            result['error'] = str(e)
            
        finally:
            # Cleanup temp audio file
            if 'audio_path' in locals():
                try:
                    os.unlink(audio_path)
                except:
                    pass
                    
        return result
        
    def calculate_accuracy(self, expected: str, actual: str) -> float:
        """Calculate accuracy based on word similarity"""
        expected_words = set(expected.lower().replace('.', '').replace(',', '').split())
        actual_words = set(actual.lower().replace('.', '').replace(',', '').split())
        
        if not expected_words:
            return 0.0
            
        common_words = expected_words & actual_words
        accuracy = (len(common_words) / len(expected_words)) * 100
        return min(accuracy, 100.0)
        
    def save_session_results(self):
        """Save session results to JSON"""
        log_dir = Path("C:/Users/gecko/.diktate/logs")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        results_file = log_dir / f"automated_selftest_results_{timestamp}.json"
        
        with open(results_file, 'w') as f:
            json.dump(self.session_results, f, indent=2)
            
        self.logger.info(f"Results saved to: {results_file}")
        
    def print_summary(self):
        """Print session summary"""
        if not self.session_results:
            return
            
        successful_tests = [r for r in self.session_results if 'error' not in r]
        
        print("\n" + "="*60)
        print("AUTOMATED SELF-TEST SESSION SUMMARY")
        print("="*60)
        
        print(f"Total tests: {len(self.session_results)}")
        print(f"Successful: {len(successful_tests)}")
        print(f"Failed: {len(self.session_results) - len(successful_tests)}")
        
        if successful_tests:
            # Transcription metrics
            avg_transcription_acc = sum(r['transcription_accuracy'] for r in successful_tests) / len(successful_tests)
            avg_processing_acc = sum(r['processing_accuracy'] for r in successful_tests) / len(successful_tests)
            avg_total_time = sum(r['total_time'] for r in successful_tests) / len(successful_tests)
            
            print(f"\nTranscription:")
            print(f"  Average accuracy: {avg_transcription_acc:.1f}%")
            print(f"  Average time: {sum(r['transcription_time'] for r in successful_tests) / len(successful_tests):.2f}s")
            
            print(f"\nProcessing (gemma3:4b):")
            print(f"  Average accuracy: {avg_processing_acc:.1f}%")
            print(f"  Average time: {sum(r['processing_time'] for r in successful_tests) / len(successful_tests):.2f}s")
            
            print(f"\nOverall:")
            print(f"  Average total time: {avg_total_time:.2f}s")
            
        print("="*60)
        
    def run_automated_loop(self, iterations: int = 1, delay_seconds: int = 5):
        """Run automated test loop"""
        self.logger.info(f"Starting automated self-test loop - {iterations} iterations")
        self.logger.info(f"Delay between tests: {delay_seconds} seconds")
        
        try:
            for iteration in range(iterations):
                self.logger.info(f"\n=== Iteration {iteration + 1}/{iterations} ===")
                
                for test_case in self.test_cases:
                    result = self.run_single_test(test_case)
                    result['iteration'] = iteration + 1
                    self.session_results.append(result)
                    
                    if delay_seconds > 0 and iteration < iterations - 1:
                        self.logger.info(f"Waiting {delay_seconds} seconds...")
                        time.sleep(delay_seconds)
                        
        except KeyboardInterrupt:
            self.logger.info("Test loop interrupted by user")
        except Exception as e:
            self.logger.error(f"Test loop failed: {e}")
        finally:
            self.save_session_results()
            self.print_summary()

if __name__ == "__main__":
    print("dIKtate Automated Self-Testing Loop")
    print("=" * 50)
    print("This will automatically test dIKtate using synthesized speech")
    print("Press Ctrl+C to stop at any time")
    print("=" * 50)
    
    try:
        iterations = int(input("Number of iterations (default 1): ").strip() or "1")
        delay = int(input("Delay between iterations in seconds (default 5): ").strip() or "5")
    except:
        iterations = 1
        delay = 5
        
    tester = AutomatedSelfTest()
    tester.run_automated_loop(iterations, delay)