#!/usr/bin/env python3
"""
dIKtate Endurance Stress Test

Long-running stress test for Gemma3:4b with video-derived audio, 
TTS variants, and hallucination resistance measurements.

Usage: python endurance_stress_test.py
"""

import os
import sys
import json
import time
import logging
import random
import subprocess
import threading
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import psutil
import wave
import numpy as np

# Add the core modules to path
sys.path.append(str(Path(__file__).parent))

from core.transcriber import WhisperTranscriber  
from core.processor import TextProcessor

class EnduranceStressTest:
    def __init__(self, config_file: str = None):
        self.setup_logging()
        self.load_config(config_file)
        self.setup_components()
        self.session_data = {
            'start_time': datetime.now().isoformat(),
            'fragments': [],
            'hourly_stats': [],
            'system_metrics': []
        }
        
    def setup_logging(self):
        """Setup dedicated logging for endurance test"""
        log_dir = Path("C:/Users/gecko/.diktate/logs")
        log_dir.mkdir(exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_file = log_dir / f"endurance_test_{timestamp}.log"
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger("ENDURANCE_TEST")
        
    def load_config(self, config_file: str = None):
        """Load test configuration"""
        if config_file and Path(config_file).exists():
            with open(config_file, 'r') as f:
                self.config = json.load(f)
        else:
            # Default configuration
            self.config = {
                'endurance_minutes': 120,
                'phrases': [
                    "The quick brown fox jumps over the lazy dog",
                    "dIKtate processes voice with Whisper and Gemma3:4b",
                    "Testing transcription accuracy at normal speed",
                    "GPU acceleration improves performance significantly",
                    "The API response time should be under thirty seconds",
                    "Please transcribe this sentence with proper punctuation",
                    "Voice dictation requires clear audio input",
                    "Machine learning models need quality training data",
                    "The system should handle various accents and tones",
                    "Error rates decrease with better audio quality",
                    "Real-time processing demands low latency",
                    "Privacy is maintained through local processing",
                    "The pipeline consists of record, transcribe, process, inject",
                    "Whisper V3 Turbo provides fast transcription",
                    "Gemma3:4b cleans text effectively",
                    "Testing resistance to hallucination over long sessions",
                    "System stability is crucial for production use",
                    "Memory usage should remain constant during extended runs",
                    "CPU utilization varies with model complexity",
                    "The user experience depends on total pipeline latency"
                ],
                'variants': [
                    {'tone': 'neutral', 'cadence': 'normal', 'speed': 1.0},
                    {'tone': 'friendly', 'cadence': 'slow', 'speed': 0.9},
                    {'tone': 'authoritative', 'cadence': 'fast', 'speed': 1.1},
                    {'tone': 'excited', 'cadence': 'normal', 'speed': 1.0}
                ],
                'use_tts': True,
                'use_video_audio': False,
                'monitor_system': True,
                'meta_test_enabled': True,
                'drift_threshold': 15.0,  # % drift threshold
                'coherence_threshold': 7.0  # 0-10 scale
            }
            
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
            
    def create_tts_audio(self, text: str, variant: Dict, output_path: str) -> bool:
        """Create TTS audio using Windows speech synthesis"""
        try:
            # Adjust speech rate based on variant speed
            rate = int((variant['speed'] - 1.0) * 10)  # Convert to SAPI rate
            
            # Select voice based on tone
            voice_map = {
                'neutral': 'Microsoft David Desktop',
                'friendly': 'Microsoft Zira Desktop', 
                'authoritative': 'Microsoft Mark Desktop',
                'excited': 'Microsoft Hazel Desktop'
            }
            voice = voice_map.get(variant['tone'], 'Microsoft David Desktop')
            
            ps_script = f'''
Add-Type -AssemblyName System.Speech
$synthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synthesizer.SelectVoice("{voice}")
$synthesizer.Rate = {rate}
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
                self.logger.error(f"TTS failed: {result.stderr}")
                return False
                
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to create TTS audio: {e}")
            return False
            
    def extract_video_audio(self, video_path: str, start_time: float, duration: float, output_path: str) -> bool:
        """Extract audio segment from video using FFmpeg"""
        try:
            cmd = [
                'ffmpeg', '-i', video_path,
                '-ss', str(start_time),
                '-t', str(duration),
                '-vn', '-acodec', 'pcm_s16le',
                '-ar', '44100', '-ac', '1',
                '-y', output_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            
            if result.returncode != 0:
                self.logger.error(f"FFmpeg failed: {result.stderr}")
                return False
                
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to extract video audio: {e}")
            return False
            
    def calculate_drift_score(self, original: str, processed: str) -> float:
        """Calculate semantic drift score (0-100)"""
        # Simple word-based drift calculation
        original_words = set(original.lower().split())
        processed_words = set(processed.lower().split())
        
        if not original_words:
            return 100.0
            
        # Calculate Jaccard distance
        intersection = original_words & processed_words
        union = original_words | processed_words
        
        similarity = len(intersection) / len(union) if union else 0
        drift = (1 - similarity) * 100
        
        return drift
        
    def calculate_coherence_score(self, text: str) -> float:
        """Calculate coherence score (0-10)"""
        if not text or not text.strip():
            return 0.0
            
        sentences = [s.strip() for s in text.split('.') if s.strip()]
        if not sentences:
            return 0.0
            
        # Score based on sentence structure and length
        coherent_sentences = 0
        for sentence in sentences:
            words = sentence.split()
            if 3 <= len(words) <= 20:  # Reasonable sentence length
                coherent_sentences += 1
                
        coherence = (coherent_sentences / len(sentences)) * 10
        return min(coherence, 10.0)
        
    def monitor_system_resources(self):
        """Monitor system resource usage"""
        if not self.config.get('monitor_system', True):
            return
            
        metrics = {
            'timestamp': datetime.now().isoformat(),
            'cpu_percent': psutil.cpu_percent(),
            'memory_percent': psutil.virtual_memory().percent,
            'memory_used_mb': psutil.virtual_memory().used / 1024 / 1024,
            'disk_usage_percent': psutil.disk_usage('/').percent
        }
        
        self.session_data['system_metrics'].append(metrics)
        
        # Log warnings for high resource usage
        if metrics['cpu_percent'] > 90:
            self.logger.warning(f"High CPU usage: {metrics['cpu_percent']:.1f}%")
        if metrics['memory_percent'] > 85:
            self.logger.warning(f"High memory usage: {metrics['memory_percent']:.1f}%")
            
    def run_single_fragment(self, phrase: str, variant: Dict, fragment_id: str) -> Dict:
        """Run a single test fragment"""
        start_time = time.time()
        
        result = {
            'fragment_id': fragment_id,
            'phrase': phrase,
            'variant': variant,
            'timestamp': datetime.now().isoformat()
        }
        
        try:
            # Step 1: Create audio
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_audio:
                audio_path = temp_audio.name
                
            if self.config.get('use_tts', True):
                if not self.create_tts_audio(phrase, variant, audio_path):
                    raise Exception("TTS audio creation failed")
            else:
                # For manual testing, you would record here
                self.logger.info(f"Please record: '{phrase}' with {variant['tone']} tone")
                input("Press Enter when ready...")
                
            # Step 2: Transcribe
            transcribe_start = time.time()
            transcribed_text = self.transcriber.transcribe(audio_path)
            transcribe_time = time.time() - transcribe_start
            result['transcribed_text'] = transcribed_text
            result['transcription_time'] = transcribe_time
            
            # Step 3: Process with Gemma3:4b
            process_start = time.time()
            processed_text = self.processor.process_text(transcribed_text)
            process_time = time.time() - process_start
            result['processed_text'] = processed_text
            result['processing_time'] = process_time
            
            # Step 4: Calculate metrics
            result['drift_score'] = self.calculate_drift_score(phrase, processed_text)
            result['coherence_score'] = self.calculate_coherence_score(processed_text)
            result['total_time'] = time.time() - start_time
            
            # Step 5: Check thresholds
            if result['drift_score'] > self.config['drift_threshold']:
                self.logger.warning(f"High drift detected: {result['drift_score']:.1f}%")
                
            if result['coherence_score'] < self.config['coherence_threshold']:
                self.logger.warning(f"Low coherence detected: {result['coherence_score']:.1f}/10")
                
            self.logger.info(f"Fragment {fragment_id} complete: {result['total_time']:.2f}s")
            
        except Exception as e:
            self.logger.error(f"Fragment {fragment_id} failed: {e}")
            result['error'] = str(e)
            
        finally:
            # Cleanup temp audio
            if 'audio_path' in locals():
                try:
                    os.unlink(audio_path)
                except:
                    pass
                    
        return result
        
    def run_endurance_test(self):
        """Run the main endurance test"""
        self.logger.info(f"Starting endurance test: {self.config['endurance_minutes']} minutes")
        
        end_time = datetime.now() + timedelta(minutes=self.config['endurance_minutes'])
        fragment_counter = 1
        last_hour = datetime.now().hour
        
        # Start system monitoring thread
        monitor_thread = threading.Thread(target=self.system_monitor_loop, daemon=True)
        monitor_thread.start()
        
        try:
            while datetime.now() < end_time:
                # Select random phrase and variant
                phrase = random.choice(self.config['phrases'])
                variant = random.choice(self.config['variants'])
                fragment_id = f"frag_{fragment_counter:04d}"
                
                # Run fragment
                result = self.run_single_fragment(phrase, variant, fragment_id)
                self.session_data['fragments'].append(result)
                
                # Check for hourly stats
                current_hour = datetime.now().hour
                if current_hour != last_hour:
                    self.calculate_hourly_stats()
                    last_hour = current_hour
                    
                fragment_counter += 1
                
                # Brief pause to prevent overwhelming the system
                time.sleep(1)
                
        except KeyboardInterrupt:
            self.logger.info("Endurance test interrupted by user")
        except Exception as e:
            self.logger.error(f"Endurance test failed: {e}")
        finally:
            self.session_data['end_time'] = datetime.now().isoformat()
            self.session_data['total_fragments'] = len(self.session_data['fragments'])
            self.save_results()
            self.print_summary()
            
    def system_monitor_loop(self):
        """Background system monitoring loop"""
        while True:
            self.monitor_system_resources()
            time.sleep(30)  # Monitor every 30 seconds
            
    def calculate_hourly_stats(self):
        """Calculate and store hourly statistics"""
        if not self.session_data['fragments']:
            return
            
        recent_fragments = self.session_data['fragments'][-60:]  # Last ~60 fragments
        if not recent_fragments:
            return
            
        successful = [f for f in recent_fragments if 'error' not in f]
        if not successful:
            return
            
        stats = {
            'timestamp': datetime.now().isoformat(),
            'total_fragments': len(recent_fragments),
            'successful_fragments': len(successful),
            'avg_total_time': sum(f['total_time'] for f in successful) / len(successful),
            'avg_transcription_time': sum(f['transcription_time'] for f in successful) / len(successful),
            'avg_processing_time': sum(f['processing_time'] for f in successful) / len(successful),
            'avg_drift_score': sum(f['drift_score'] for f in successful) / len(successful),
            'avg_coherence_score': sum(f['coherence_score'] for f in successful) / len(successful)
        }
        
        self.session_data['hourly_stats'].append(stats)
        self.logger.info(f"Hourly stats: {stats['avg_total_time']:.2f}s avg, {stats['avg_drift_score']:.1f}% drift")
        
    def save_results(self):
        """Save test results to JSON file"""
        log_dir = Path("C:/Users/gecko/.diktate/logs")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        results_file = log_dir / f"endurance_results_{timestamp}.json"
        
        with open(results_file, 'w') as f:
            json.dump(self.session_data, f, indent=2)
            
        self.logger.info(f"Results saved to: {results_file}")
        
        # Also save CSV summary
        csv_file = log_dir / f"endurance_summary_{timestamp}.csv"
        self.save_csv_summary(csv_file)
        
    def save_csv_summary(self, csv_file: Path):
        """Save CSV summary of results"""
        successful_fragments = [f for f in self.session_data['fragments'] if 'error' not in f]
        
        with open(csv_file, 'w') as f:
            f.write("fragment_id,timestamp,total_time,transcription_time,processing_time,drift_score,coherence_score\n")
            for fragment in successful_fragments:
                f.write(f"{fragment['fragment_id']},{fragment['timestamp']},{fragment['total_time']:.3f},")
                f.write(f"{fragment['transcription_time']:.3f},{fragment['processing_time']:.3f},")
                f.write(f"{fragment['drift_score']:.1f},{fragment['coherence_score']:.1f}\n")
                
        self.logger.info(f"CSV summary saved to: {csv_file}")
        
    def print_summary(self):
        """Print test summary"""
        fragments = self.session_data['fragments']
        successful = [f for f in fragments if 'error' not in f]
        
        print("\n" + "="*60)
        print("ENDURANCE STRESS TEST SUMMARY")
        print("="*60)
        
        print(f"Test Duration: {self.config['endurance_minutes']} minutes")
        print(f"Total Fragments: {len(fragments)}")
        print(f"Successful: {len(successful)}")
        print(f"Failed: {len(fragments) - len(successful)}")
        
        if successful:
            print(f"\nPerformance Metrics:")
            print(f"  Average Total Time: {sum(f['total_time'] for f in successful) / len(successful):.2f}s")
            print(f"  Average Transcription: {sum(f['transcription_time'] for f in successful) / len(successful):.2f}s")
            print(f"  Average Processing: {sum(f['processing_time'] for f in successful) / len(successful):.2f}s")
            
            print(f"\nQuality Metrics:")
            print(f"  Average Drift: {sum(f['drift_score'] for f in successful) / len(successful):.1f}%")
            print(f"  Average Coherence: {sum(f['coherence_score'] for f in successful) / len(successful):.1f}/10")
            
            # Check for concerning trends
            avg_drift = sum(f['drift_score'] for f in successful) / len(successful)
            avg_coherence = sum(f['coherence_score'] for f in successful) / len(successful)
            
            if avg_drift > self.config['drift_threshold']:
                print(f"\n⚠️  WARNING: High average drift ({avg_drift:.1f}% > {self.config['drift_threshold']}%)")
                
            if avg_coherence < self.config['coherence_threshold']:
                print(f"\n⚠️  WARNING: Low average coherence ({avg_coherence:.1f} < {self.config['coherence_threshold']})")
                
        if self.session_data['hourly_stats']:
            print(f"\nHourly Breakdown:")
            for i, stats in enumerate(self.session_data['hourly_stats']):
                print(f"  Hour {i+1}: {stats['avg_total_time']:.2f}s avg, {stats['avg_drift_score']:.1f}% drift")
                
        print("="*60)

if __name__ == "__main__":
    print("dIKtate Endurance Stress Test")
    print("=" * 50)
    print("This will run a long-duration stress test of Gemma3:4b")
    print("Press Ctrl+C to stop at any time")
    print("=" * 50)
    
    # Check for custom config file
    config_file = sys.argv[1] if len(sys.argv) > 1 else None
    
    tester = EnduranceStressTest(config_file)
    tester.run_endurance_test()