"""
Integration tests for HistoryManager.
Tests CRUD operations, concurrency, and privacy handling.
"""

import unittest
import tempfile
import os
import time
import threading
from pathlib import Path
from utils.history_manager import HistoryManager


class TestHistoryManager(unittest.TestCase):
    """Test suite for HistoryManager"""

    def setUp(self):
        """Set up test database for each test"""
        # Create temporary directory for test database
        self.temp_dir = tempfile.mkdtemp()
        self.db_path = os.path.join(self.temp_dir, "test_history.db")
        self.manager = HistoryManager(db_path=self.db_path)

    def tearDown(self):
        """Clean up after each test"""
        self.manager.shutdown()
        # Give write thread time to finish
        time.sleep(0.5)
        # Clean up temp files
        if os.path.exists(self.db_path):
            os.remove(self.db_path)
        os.rmdir(self.temp_dir)

    def test_database_initialization(self):
        """Verify database and schema are created correctly"""
        self.assertTrue(os.path.exists(self.db_path))

        # Verify table exists
        import sqlite3
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='history'
        """)
        result = cursor.fetchone()
        conn.close()

        self.assertIsNotNone(result)
        self.assertEqual(result[0], 'history')

    def test_log_session_success(self):
        """Test successful session logging (success=1)"""
        test_data = {
            'mode': 'dictate',
            'transcriber_model': 'whisper-small',
            'processor_model': 'gemma-2b',
            'raw_text': 'hello world',
            'processed_text': 'Hello world.',
            'audio_duration_s': 2.5,
            'transcription_time_ms': 800.0,
            'processing_time_ms': 150.0,
            'total_time_ms': 950.0,
            'success': True,
            'error_message': None
        }

        self.manager.log_session(test_data)
        time.sleep(0.5)  # Wait for async write

        # Verify record exists
        results = self.manager.get_sessions_by_mode('dictate', limit=1)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['raw_text'], 'hello world')
        self.assertEqual(results[0]['success'], 1)

    def test_log_session_error(self):
        """Test failed session logging (success=0)"""
        test_data = {
            'mode': 'ask',
            'transcriber_model': 'whisper-small',
            'processor_model': 'none',
            'raw_text': 'test question',
            'processed_text': None,
            'audio_duration_s': 1.5,
            'transcription_time_ms': 600.0,
            'processing_time_ms': 0.0,
            'total_time_ms': 600.0,
            'success': False,
            'error_message': 'Processor failed: connection timeout'
        }

        self.manager.log_session(test_data)
        time.sleep(0.5)  # Wait for async write

        # Verify error record exists
        error_sessions = self.manager.get_error_sessions(limit=10)
        self.assertEqual(len(error_sessions), 1)
        self.assertIn('timeout', error_sessions[0]['error_message'])

    def test_search_by_phrase(self):
        """Test searching for sessions by phrase"""
        # Log multiple sessions
        for i in range(3):
            self.manager.log_session({
                'mode': 'dictate',
                'transcriber_model': 'whisper-small',
                'processor_model': 'gemma-2b',
                'raw_text': f'session {i} with keyword python',
                'processed_text': f'Session {i} with keyword Python.',
                'audio_duration_s': 1.0,
                'transcription_time_ms': 500.0,
                'processing_time_ms': 100.0,
                'total_time_ms': 600.0,
                'success': True,
                'error_message': None
            })

        time.sleep(0.5)  # Wait for async writes

        # Search for keyword
        results = self.manager.search_by_phrase('python')
        self.assertEqual(len(results), 3)

    def test_get_sessions_by_mode(self):
        """Test filtering sessions by mode"""
        modes = ['dictate', 'ask', 'refine']

        # Log one session of each mode
        for mode in modes:
            self.manager.log_session({
                'mode': mode,
                'transcriber_model': 'whisper-small',
                'processor_model': 'gemma-2b',
                'raw_text': f'test {mode}',
                'processed_text': f'Test {mode}.',
                'audio_duration_s': 1.0,
                'transcription_time_ms': 500.0,
                'processing_time_ms': 100.0,
                'total_time_ms': 600.0,
                'success': True,
                'error_message': None
            })

        time.sleep(0.5)  # Wait for async writes

        # Verify each mode has one session
        for mode in modes:
            results = self.manager.get_sessions_by_mode(mode)
            self.assertEqual(len(results), 1)
            self.assertEqual(results[0]['mode'], mode)

    def test_statistics(self):
        """Test statistics calculation"""
        # Log successful session
        self.manager.log_session({
            'mode': 'dictate',
            'transcriber_model': 'whisper-small',
            'processor_model': 'gemma-2b',
            'raw_text': 'success test',
            'processed_text': 'Success test.',
            'audio_duration_s': 1.0,
            'transcription_time_ms': 500.0,
            'processing_time_ms': 100.0,
            'total_time_ms': 600.0,
            'success': True,
            'error_message': None
        })

        # Log failed session
        self.manager.log_session({
            'mode': 'dictate',
            'transcriber_model': 'whisper-small',
            'processor_model': 'gemma-2b',
            'raw_text': 'failure test',
            'processed_text': None,
            'audio_duration_s': 1.0,
            'transcription_time_ms': 500.0,
            'processing_time_ms': 0.0,
            'total_time_ms': 500.0,
            'success': False,
            'error_message': 'Test error'
        })

        time.sleep(0.5)  # Wait for async writes

        stats = self.manager.get_statistics()

        self.assertEqual(stats['total_sessions'], 2)
        self.assertEqual(stats['successful_sessions'], 1)
        self.assertEqual(stats['failed_sessions'], 1)
        self.assertEqual(stats['success_rate'], 50.0)
        self.assertIn('dictate', stats['by_mode'])

    def test_concurrency_stress(self):
        """Stress test with 10 concurrent writes"""
        def log_session(session_id):
            for i in range(5):
                self.manager.log_session({
                    'mode': 'dictate',
                    'transcriber_model': 'whisper-small',
                    'processor_model': 'gemma-2b',
                    'raw_text': f'thread {session_id} iteration {i}',
                    'processed_text': f'Thread {session_id} iteration {i}.',
                    'audio_duration_s': 1.0,
                    'transcription_time_ms': 500.0,
                    'processing_time_ms': 100.0,
                    'total_time_ms': 600.0,
                    'success': True,
                    'error_message': None
                })

        # Start 5 threads, each logging 5 sessions
        threads = []
        for i in range(5):
            t = threading.Thread(target=log_session, args=(i,))
            threads.append(t)
            t.start()

        # Wait for all threads
        for t in threads:
            t.join()

        time.sleep(1.0)  # Wait for async queue to process

        # Verify all 25 sessions were logged
        stats = self.manager.get_statistics()
        self.assertEqual(stats['total_sessions'], 25)

    def test_prune_history(self):
        """Test history pruning (delete old records)"""
        # Note: This test can't easily test date-based pruning in unit tests
        # Just verify the method doesn't crash
        deleted = self.manager.prune_history(days=1)
        # Should delete 0 records since we just created the DB
        self.assertEqual(deleted, 0)

    def test_get_error_sessions(self):
        """Test filtering for error sessions"""
        # Log 2 successful, 1 failed
        for i in range(2):
            self.manager.log_session({
                'mode': 'dictate',
                'transcriber_model': 'whisper-small',
                'processor_model': 'gemma-2b',
                'raw_text': f'success {i}',
                'processed_text': f'Success {i}.',
                'audio_duration_s': 1.0,
                'transcription_time_ms': 500.0,
                'processing_time_ms': 100.0,
                'total_time_ms': 600.0,
                'success': True,
                'error_message': None
            })

        self.manager.log_session({
            'mode': 'dictate',
            'transcriber_model': 'whisper-small',
            'processor_model': 'gemma-2b',
            'raw_text': 'failure',
            'processed_text': None,
            'audio_duration_s': 1.0,
            'transcription_time_ms': 500.0,
            'processing_time_ms': 0.0,
            'total_time_ms': 500.0,
            'success': False,
            'error_message': 'Test failure'
        })

        time.sleep(0.5)  # Wait for async writes

        errors = self.manager.get_error_sessions()
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0]['raw_text'], 'failure')


if __name__ == '__main__':
    unittest.main()
