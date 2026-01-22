#!/usr/bin/env python3
"""
dIKtate Meta-Test: Testing dIKtate with its own output

This script specifically tests the self-referential capability:
1. Start with a simple test prompt
2. Use dIKtate to process it
3. Create a new test prompt that references the previous output
4. Repeat to create a "conversation" with dIKtate
5. Track how the system handles self-reference

Usage: python meta_test.py
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

from core.transcriber import WhisperTranscriber  
from core.processor import TextProcessor

class MetaTest:
    def __init__(self):
        self.setup_logging()
        self.setup_components()
        self.conversation_history = []
        self.test_results = []
        
    def setup_logging(self):
        """Setup dedicated logging for meta-test"""
        log_dir = Path("C:/Users/gecko/.diktate/logs")
        log_dir.mkdir(exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_file = log_dir / f"meta_test_{timestamp}.log"
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger("META_TEST")
        
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
            
    def get_initial_prompt(self):
        """Get the initial meta-test prompt"""
        return """I am testing dIKtate's ability to process its own output. 
This text will be transcribed and processed by gemma3:4b, 
then used to create the next test prompt."""
        
    def create_meta_prompt(self, previous_output: str, round_number: int) -> str:
        """Create a new meta-prompt based on previous output"""
        return f"""Round {round_number} of the dIKtate meta-test. 
The previous output was: "{previous_output}"
Now I am testing how dIKtate handles self-reference in round {round_number + 1}.
Can dIKtate accurately process text that talks about dIKtate itself?"""
        
    def simulate_recording(self, text: str) -> str:
        """Simulate recording by directly processing text (for testing)"""
        # In a real scenario, this would be:
        # 1. Record audio of user speaking the text
        # 2. Transcribe it with Whisper
        # 3. Process with gemma3:4b
        
        # For testing, we'll simulate transcription errors
        simulated_transcription = text.replace("dIKtate", "dik-tate").replace("gemma3:4b", "gemma 3 4b")
        return simulated_transcription
        
    def run_meta_round(self, prompt_text: str, round_number: int) -> dict:
        """Run a single round of meta-testing"""
        self.logger.info(f"=== Meta-Test Round {round_number} ===")
        self.logger.info(f"Prompt: {prompt_text[:100]}...")
        
        result = {
            'round': round_number,
            'timestamp': datetime.now().isoformat(),
            'input_prompt': prompt_text
        }
        
        try:
            # Step 1: Simulate recording/transcription
            start_time = time.time()
            transcribed_text = self.simulate_recording(prompt_text)
            transcription_time = time.time() - start_time
            result['transcribed_text'] = transcribed_text
            result['transcription_time'] = transcription_time
            self.logger.info(f"Transcribed: {transcribed_text}")
            
            # Step 2: Process with gemma3:4b
            process_start = time.time()
            processed_text = self.processor.process_text(transcribed_text)
            process_time = time.time() - process_start
            result['processed_text'] = processed_text
            result['processing_time'] = process_time
            self.logger.info(f"Processed: {processed_text}")
            
            # Step 3: Store in conversation history
            self.conversation_history.append({
                'round': round_number,
                'prompt': prompt_text,
                'output': processed_text
            })
            
            # Step 4: Calculate metrics
            result['total_time'] = transcription_time + process_time
            result['self_reference_score'] = self.calculate_self_reference_score(prompt_text, processed_text)
            result['coherence_score'] = self.calculate_coherence_score(processed_text)
            
            self.logger.info(f"Round complete! Total time: {result['total_time']:.2f}s")
            self.logger.info(f"Self-reference score: {result['self_reference_score']:.1f}/10")
            self.logger.info(f"Coherence score: {result['coherence_score']:.1f}/10")
            
        except Exception as e:
            self.logger.error(f"Meta-test round {round_number} failed: {e}")
            result['error'] = str(e)
            
        return result
        
    def calculate_self_reference_score(self, prompt: str, output: str) -> float:
        """Score how well the system handles self-reference"""
        self_ref_terms = ['diktate', 'gemma', 'meta-test', 'self-reference', 'output']
        
        prompt_refs = sum(1 for term in self_ref_terms if term.lower() in prompt.lower())
        output_refs = sum(1 for term in self_ref_terms if term.lower() in output.lower())
        
        if prompt_refs == 0:
            return 10.0  # No self-reference to handle
            
        return min((output_refs / prompt_refs) * 10, 10.0)
        
    def calculate_coherence_score(self, text: str) -> float:
        """Simple coherence scoring based on sentence structure"""
        sentences = text.split('.')
        if not sentences:
            return 0.0
            
        # Check for basic sentence structure
        coherent_sentences = 0
        for sentence in sentences:
            sentence = sentence.strip()
            if sentence and len(sentence) > 10:  # Basic length check
                words = sentence.split()
                if len(words) >= 3:  # At least 3 words
                    coherent_sentences += 1
                    
        return (coherent_sentences / len(sentences)) * 10 if sentences else 0.0
        
    def run_meta_test(self, rounds: int = 5):
        """Run the complete meta-test"""
        self.logger.info(f"Starting dIKtate meta-test - {rounds} rounds")
        self.logger.info("Testing self-referential processing capability...")
        
        try:
            # Start with initial prompt
            current_prompt = self.get_initial_prompt()
            
            for round_num in range(1, rounds + 1):
                result = self.run_meta_round(current_prompt, round_num)
                self.test_results.append(result)
                
                # Create next prompt based on output (if not last round)
                if round_num < rounds and 'processed_text' in result:
                    current_prompt = self.create_meta_prompt(
                        result['processed_text'], 
                        round_num
                    )
                    
                # Brief pause between rounds
                if round_num < rounds:
                    time.sleep(2)
                    
        except KeyboardInterrupt:
            self.logger.info("Meta-test interrupted by user")
        except Exception as e:
            self.logger.error(f"Meta-test failed: {e}")
        finally:
            self.save_results()
            self.print_summary()
            
    def save_results(self):
        """Save meta-test results"""
        log_dir = Path("C:/Users/gecko/.diktate/logs")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save test results
        results_file = log_dir / f"meta_test_results_{timestamp}.json"
        with open(results_file, 'w') as f:
            json.dump({
                'test_results': self.test_results,
                'conversation_history': self.conversation_history
            }, f, indent=2)
            
        # Save conversation as readable text
        conversation_file = log_dir / f"meta_conversation_{timestamp}.txt"
        with open(conversation_file, 'w') as f:
            f.write("dIKtate Meta-Test Conversation\n")
            f.write("=" * 40 + "\n\n")
            
            for item in self.conversation_history:
                f.write(f"Round {item['round']}:\n")
                f.write(f"Prompt: {item['prompt']}\n")
                f.write(f"Output: {item['output']}\n")
                f.write("-" * 40 + "\n\n")
                
        self.logger.info(f"Results saved to: {results_file}")
        self.logger.info(f"Conversation saved to: {conversation_file}")
        
    def print_summary(self):
        """Print meta-test summary"""
        if not self.test_results:
            return
            
        successful_rounds = [r for r in self.test_results if 'error' not in r]
        
        print("\n" + "="*60)
        print("dIKtate META-TEST SUMMARY")
        print("="*60)
        
        print(f"Total rounds: {len(self.test_results)}")
        print(f"Successful: {len(successful_rounds)}")
        print(f"Failed: {len(self.test_results) - len(successful_rounds)}")
        
        if successful_rounds:
            avg_self_ref = sum(r['self_reference_score'] for r in successful_rounds) / len(successful_rounds)
            avg_coherence = sum(r['coherence_score'] for r in successful_rounds) / len(successful_rounds)
            avg_time = sum(r['total_time'] for r in successful_rounds) / len(successful_rounds)
            
            print(f"\nSelf-Reference Handling: {avg_self_ref:.1f}/10")
            print(f"Output Coherence: {avg_coherence:.1f}/10")
            print(f"Average Processing Time: {avg_time:.2f}s")
            
            # Show conversation progression
            print(f"\nConversation Progression:")
            for item in self.conversation_history:
                print(f"  Round {item['round']}: {item['output'][:60]}...")
                
        print("="*60)

if __name__ == "__main__":
    print("dIKtate Meta-Test: Self-Referential Processing")
    print("=" * 50)
    print("This tests how dIKtate handles text about itself")
    print("Press Ctrl+C to stop at any time")
    print("=" * 50)
    
    try:
        rounds = int(input("Number of test rounds (default 5): ").strip() or "5")
    except:
        rounds = 5
        
    tester = MetaTest()
    tester.run_meta_test(rounds)