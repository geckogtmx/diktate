#!/usr/bin/env python3
"""
dIKtate Self-Testing Loop

This script creates a self-testing cycle where dIKtate:
1. Records a test prompt
2. Transcribes it 
3. Processes it with gemma3:4b
4. Uses the processed text as the next test prompt
5. Logs performance and accuracy metrics
6. Repeats continuously

Usage: python self_test_loop.py
"""

import os
import sys
import json
import time
import logging
from datetime import datetime
from pathlib import Path

# Add the core modules to path
sys.path.append(str(Path(__file__).parent))

from core.recorder import AudioRecorder
from core.transcriber import WhisperTranscriber  
from core.processor import TextProcessor
from config.prompts import get_prompt

class SelfTestLoop:
    def __init__(self):
        self.setup_logging()
        self.setup_components()
        self.test_prompts = self.get_test_prompts()
        self.current_prompt_index = 0
        self.session_results = []
        
    def setup_logging(self):
        """Setup dedicated logging for self-test"""
        log_dir = Path("C:/Users/gecko/.diktate/logs")
        log_dir.mkdir(exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_file = log_dir / f"selftest_{timestamp}.log"
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger("SELFTEST")
        
    def setup_components(self):
        """Initialize dIKtate components"""
        self.logger.info("Initializing components...")
        
        try:
            self.recorder = AudioRecorder()
            self.transcriber = WhisperTranscriber()
            self.processor = TextProcessor()
            self.logger.info("All components initialized successfully")
        except Exception as e:
            self.logger.error(f"Failed to initialize components: {e}")
            raise
            
    def get_test_prompts(self):
        """Get initial test prompts - these will evolve as we test"""
        return [
            "This is a test of the dIKtate self-recording system. Please transcribe this sentence accurately.",
            "The quick brown fox jumps over the lazy dog. This sentence contains all letters of the alphabet.",
            "dIKtate should process this text with gemma3:4b and return a cleaned version with proper punctuation.",
            "Testing, testing, one, two, three. How does the system handle verbal commas and pauses like um and uh?",
            "This is a complex sentence with multiple clauses, punctuation marks, and some technical terms like API and GPU that should be preserved."
        ]
        
    def get_next_prompt(self):
        """Get the next prompt to test - either from processed results or initial set"""
        if self.session_results and len(self.session_results) > 0:
            # Use the most recent processed result as the next test
            last_result = self.session_results[-1]
            if last_result.get('processed_text'):
                # Create a meta-test prompt
                return f"Testing the system with its own output: {last_result['processed_text']}"
        
        # Use initial test prompts
        prompt = self.test_prompts[self.current_prompt_index]
        self.current_prompt_index = (self.current_prompt_index + 1) % len(self.test_prompts)
        return prompt
        
    def run_single_test(self, test_prompt: str) -> dict:
        """Run a single test cycle"""
        self.logger.info(f"Starting test with prompt: {test_prompt[:50]}...")
        
        result = {
            'timestamp': datetime.now().isoformat(),
            'original_prompt': test_prompt,
            'test_number': len(self.session_results) + 1
        }
        
        try:
            # Step 1: Display prompt for user to read
            self.logger.info("=== PLEASE READ THIS ALOUD ===")
            self.logger.info(f"TEST PROMPT: {test_prompt}")
            self.logger.info("Press Enter to start recording...")
            input()
            
            # Step 2: Record
            start_time = time.time()
            self.logger.info("Starting recording...")
            self.recorder.start_recording()
            
            self.logger.info("Recording... Press Enter to stop")
            input()
            
            audio_path = self.recorder.stop_recording()
            record_time = time.time() - start_time
            result['recording_time'] = record_time
            self.logger.info(f"Recording complete: {record_time:.2f}s")
            
            # Step 3: Transcribe
            transcribe_start = time.time()
            self.logger.info("Transcribing audio...")
            transcribed_text = self.transcriber.transcribe(audio_path)
            transcribe_time = time.time() - transcribe_start
            result['transcription_time'] = transcribe_time
            result['transcribed_text'] = transcribed_text
            self.logger.info(f"Transcription complete: {transcribe_time:.2f}s")
            self.logger.info(f"Transcribed: {transcribed_text}")
            
            # Step 4: Process with gemma3:4b
            process_start = time.time()
            self.logger.info("Processing with gemma3:4b...")
            processed_text = self.processor.process_text(transcribed_text)
            process_time = time.time() - process_start
            result['processing_time'] = process_time
            result['processed_text'] = processed_text
            self.logger.info(f"Processing complete: {process_time:.2f}s")
            self.logger.info(f"Processed: {processed_text}")
            
            # Step 5: Calculate accuracy
            result['accuracy'] = self.calculate_accuracy(test_prompt, processed_text)
            result['total_time'] = record_time + transcribe_time + process_time
            
            self.logger.info(f"Test complete! Total time: {result['total_time']:.2f}s")
            self.logger.info(f"Accuracy score: {result['accuracy']:.1f}%")
            
        except Exception as e:
            self.logger.error(f"Test failed: {e}")
            result['error'] = str(e)
            
        return result
        
    def calculate_accuracy(self, original: str, processed: str) -> float:
        """Simple accuracy calculation based on word similarity"""
        original_words = set(original.lower().split())
        processed_words = set(processed.lower().split())
        
        if not original_words:
            return 0.0
            
        common_words = original_words & processed_words
        accuracy = (len(common_words) / len(original_words)) * 100
        return min(accuracy, 100.0)  # Cap at 100%
        
    def save_session_results(self):
        """Save session results to JSON"""
        log_dir = Path("C:/Users/gecko/.diktate/logs")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        results_file = log_dir / f"selftest_results_{timestamp}.json"
        
        with open(results_file, 'w') as f:
            json.dump(self.session_results, f, indent=2)
            
        self.logger.info(f"Results saved to: {results_file}")
        
    def print_summary(self):
        """Print session summary"""
        if not self.session_results:
            return
            
        successful_tests = [r for r in self.session_results if 'error' not in r]
        
        print("\n" + "="*60)
        print("SELF-TEST SESSION SUMMARY")
        print("="*60)
        
        print(f"Total tests: {len(self.session_results)}")
        print(f"Successful: {len(successful_tests)}")
        print(f"Failed: {len(self.session_results) - len(successful_tests)}")
        
        if successful_tests:
            avg_accuracy = sum(r['accuracy'] for r in successful_tests) / len(successful_tests)
            avg_total_time = sum(r['total_time'] for r in successful_tests) / len(successful_tests)
            
            print(f"Average accuracy: {avg_accuracy:.1f}%")
            print(f"Average total time: {avg_total_time:.2f}s")
            
            # Performance breakdown
            avg_record = sum(r['recording_time'] for r in successful_tests) / len(successful_tests)
            avg_transcribe = sum(r['transcription_time'] for r in successful_tests) / len(successful_tests)
            avg_process = sum(r['processing_time'] for r in successful_tests) / len(successful_tests)
            
            print(f"Average recording: {avg_record:.2f}s")
            print(f"Average transcription: {avg_transcribe:.2f}s")
            print(f"Average processing: {avg_process:.2f}s")
            
        print("="*60)
        
    def run_loop(self, max_tests: int = None):
        """Run the self-test loop"""
        self.logger.info("Starting dIKtate self-test loop")
        self.logger.info("Press Ctrl+C to stop at any time")
        
        try:
            test_count = 0
            while max_tests is None or test_count < max_tests:
                test_prompt = self.get_next_prompt()
                result = self.run_single_test(test_prompt)
                self.session_results.append(result)
                test_count += 1
                
                # Ask if user wants to continue
                if max_tests is None:
                    continue_test = input("\nContinue testing? (y/n): ").lower().strip()
                    if continue_test != 'y':
                        break
                        
        except KeyboardInterrupt:
            self.logger.info("Test loop interrupted by user")
        except Exception as e:
            self.logger.error(f"Test loop failed: {e}")
        finally:
            self.save_session_results()
            self.print_summary()

if __name__ == "__main__":
    print("dIKtate Self-Testing Loop")
    print("=" * 40)
    print("This will test dIKtate using its own output")
    print("Make sure your microphone is working")
    print("Press Ctrl+C to stop at any time")
    print("=" * 40)
    
    max_tests = input("Number of tests to run (leave blank for infinite): ").strip()
    max_tests = int(max_tests) if max_tests.isdigit() else None
    
    tester = SelfTestLoop()
    tester.run_loop(max_tests)