#!/usr/bin/env python3
"""
DinoCore Production Flasher - Local Cache Manager
Intelligent caching layer for Firebase data with offline support
"""

import os
import json
import time
import threading
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime, timedelta
from enum import Enum

class CacheMode(Enum):
    """Cache operation modes"""
    OFFLINE_FIRST = "offline_first"  # Try local first, sync to cloud later
    ONLINE_FIRST = "online_first"   # Try cloud first, fallback to local
    HYBRID = "hybrid"               # Use both, sync automatically

class CacheManager:
    """Intelligent local cache manager for Firebase data"""

    def __init__(self, cache_dir: str = ".cache", mode: CacheMode = CacheMode.OFFLINE_FIRST):
        self.cache_dir = cache_dir
        self.mode = mode
        self.firebase_db = None
        self.sync_lock = threading.Lock()
        self.sync_interval = 300  # 5 minutes

        # Ensure cache directory exists
        os.makedirs(self.cache_dir, exist_ok=True)

        # Cache metadata
        self.cache_metadata = os.path.join(self.cache_dir, "metadata.json")
        self.last_sync_file = os.path.join(self.cache_dir, "last_sync.txt")

        # Start background sync
        self.stop_sync = False
        self.sync_thread = threading.Thread(target=self._background_sync_worker, daemon=True)
        self.sync_thread.start()

    def set_firebase_db(self, firebase_db):
        """Set the Firebase database instance"""
        self.firebase_db = firebase_db

    def _get_cache_file_path(self, collection: str, document_id: str = None) -> str:
        """Get cache file path for a collection/document"""
        if document_id:
            return os.path.join(self.cache_dir, f"{collection}_{document_id}.json")
        else:
            return os.path.join(self.cache_dir, f"{collection}.json")

    def _load_cache(self, collection: str, document_id: str = None) -> Optional[Dict[str, Any]]:
        """Load data from local cache"""
        cache_file = self._get_cache_file_path(collection, document_id)

        if not os.path.exists(cache_file):
            return None

        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # Check if cache is still valid
                timestamp = data.get('_cache_timestamp', 0)
                max_age = data.get('_cache_max_age', 3600)  # Default 1 hour

                if time.time() - timestamp > max_age:
                    # Cache expired, remove it
                    os.remove(cache_file)
                    return None

                return data
        except Exception:
            # Invalid cache file, remove it
            try:
                os.remove(cache_file)
            except:
                pass
            return None

    def _save_cache(self, collection: str, data: Dict[str, Any], max_age: int = 3600, document_id: str = None):
        """Save data to local cache"""
        cache_file = self._get_cache_file_path(collection, document_id)

        # Add cache metadata
        cache_data = data.copy()
        cache_data['_cache_timestamp'] = time.time()
        cache_data['_cache_max_age'] = max_age

        try:
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(cache_data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Error saving cache: {e}")

    def get(self, collection: str, document_id: str = None, use_cache: bool = True) -> Optional[Dict[str, Any]]:
        """Get data from cache or Firebase based on mode"""
        if self.mode == CacheMode.OFFLINE_FIRST and use_cache:
            # Try cache first
            cached_data = self._load_cache(collection, document_id)
            if cached_data:
                # Remove cache metadata before returning
                data = cached_data.copy()
                data.pop('_cache_timestamp', None)
                data.pop('_cache_max_age', None)
                return data

        # Try Firebase or fall back to cache
        if self.firebase_db and self.firebase_db.initialized:
            try:
                if document_id:
                    # Single document
                    doc_ref = self.firebase_db.db.collection(collection).document(document_id)
                    doc = doc_ref.get()
                    if doc.exists:
                        firebase_data = doc.to_dict()
                        # Save to cache
                        self._save_cache(collection, firebase_data, document_id=document_id)
                        return firebase_data
                else:
                    # Collection query (simplified - get all documents)
                    docs = self.firebase_db.db.collection(collection).stream()
                    firebase_data = {}
                    for doc in docs:
                        firebase_data[doc.id] = doc.to_dict()

                    if firebase_data:
                        # Save collection to cache
                        self._save_cache(collection, firebase_data)
                        return firebase_data

            except Exception as e:
                print(f"Firebase query error: {e}")

        # Fall back to cache if Firebase failed and we haven't tried it yet
        if self.mode != CacheMode.OFFLINE_FIRST or (self.mode == CacheMode.OFFLINE_FIRST and not use_cache):
            cached_data = self._load_cache(collection, document_id)
            if cached_data:
                # Remove cache metadata before returning
                data = cached_data.copy()
                data.pop('_cache_timestamp', None)
                data.pop('_cache_max_age', None)
                return data

        return None

    def set(self, collection: str, data: Dict[str, Any], document_id: str = None) -> bool:
        """Save data to both Firebase and cache"""
        success = False

        # Try to save to Firebase first
        if self.firebase_db and self.firebase_db.initialized:
            try:
                if document_id:
                    doc_ref = self.firebase_db.db.collection(collection).document(document_id)
                    doc_ref.set(data)
                else:
                    # For collections, we'd need to handle differently
                    # Assume document_id is always provided for now
                    return False

                success = True

                # Update cache with fresh data
                self._save_cache(collection, data, document_id=document_id)

            except Exception as e:
                print(f"Firebase save error: {e}")
                success = False

        # Always save to cache as backup/fallback
        self._save_cache(collection, data, document_id=document_id)

        return success

    def get_qc_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get QC test history with caching"""
        cached_history = self.get('qc_results')
        if cached_history:
            # Convert cached dict to list and sort by timestamp
            results = list(cached_history.values())
            results.sort(key=lambda x: x.get('timestamp', 0), reverse=True)
            return results[:limit]

        return []

    def get_flash_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get flash operation history with caching"""
        cached_history = self.get('flash_logs')
        if cached_history:
            # Convert cached dict to list and sort by timestamp
            results = list(cached_history.values())
            results.sort(key=lambda x: x.get('timestamp', 0), reverse=True)
            return results[:limit]

        return []

    def store_qc_results(self, device_info: Dict[str, Any], test_results: List[Dict[str, Any]]) -> bool:
        """Store QC results with caching"""
        # Create document data
        import uuid
        doc_id = f"qc_{str(uuid.uuid4())[:8]}"
        doc_data = {
            'device_info': device_info,
            'test_results': test_results,
            'total_tests': len(test_results),
            'passed_tests': sum(1 for r in test_results if r.get('status') == 'pass'),
            'failed_tests': sum(1 for r in test_results if r.get('status') == 'fail'),
            'session_id': doc_id,
            'device_name': device_info.get('name', 'Unknown'),
            'device_address': device_info.get('address', 'Unknown'),
            'timestamp': datetime.utcnow().isoformat()
        }

        return self.set('qc_results', doc_data, doc_id)

    def store_flash_log(self, device_info: Dict[str, Any], flash_result: Dict[str, Any]) -> bool:
        """Store flash log with caching"""
        import uuid
        doc_id = f"flash_{str(uuid.uuid4())[:8]}"
        doc_data = {
            'device_info': device_info,
            'flash_result': flash_result,
            'operation_type': 'flash',
            'success': flash_result.get('success', False),
            'mode': flash_result.get('mode', 'unknown'),
            'hardware_version': flash_result.get('hardware_version', 'unknown'),
            'duration': flash_result.get('duration', 0),
            'error_message': flash_result.get('error', ''),
            'session_id': doc_id,
            'timestamp': datetime.utcnow().isoformat()
        }

        return self.set('flash_logs', doc_data, doc_id)

    def get_device_inventory(self) -> Dict[str, Any]:
        """Get cached device inventory data"""
        return self.get('devices') or {}

    def update_device_inventory(self, device_data: Dict[str, Any]) -> bool:
        """Update device inventory"""
        inventory = self.get_device_inventory()
        device_id = device_data.get('device_id', device_data.get('address', 'unknown'))

        inventory[device_id] = {
            **inventory.get(device_id, {}),
            **device_data,
            'last_updated': datetime.utcnow().isoformat()
        }

        return self.set('devices', inventory)

    def _background_sync_worker(self):
        """Background thread for automatic sync"""
        while not self.stop_sync:
            try:
                # Sleep for sync interval
                time.sleep(self.sync_interval)

                # Perform sync if Firebase is available
                if self.firebase_db and self.firebase_db.initialized:
                    self._sync_to_cloud()

            except Exception as e:
                print(f"Background sync error: {e}")

    def _sync_to_cloud(self):
        """Sync local cache to cloud"""
        with self.sync_lock:
            try:
                # Sync QC results
                qc_cache = self._load_cache('qc_results')
                if qc_cache:
                    for doc_id, data in qc_cache.items():
                        if doc_id.startswith('qc_'):
                            try:
                                doc_data = data.copy()
                                doc_data.pop('_cache_timestamp', None)
                                doc_data.pop('_cache_max_age', None)
                                self.firebase_db.db.collection('qc_results').document(doc_id).set(doc_data)
                            except Exception as e:
                                print(f"Sync QC error for {doc_id}: {e}")

                # Sync flash logs
                flash_cache = self._load_cache('flash_logs')
                if flash_cache:
                    for doc_id, data in flash_cache.items():
                        if doc_id.startswith('flash_'):
                            try:
                                doc_data = data.copy()
                                doc_data.pop('_cache_timestamp', None)
                                doc_data.pop('_cache_max_age', None)
                                self.firebase_db.db.collection('flash_logs').document(doc_id).set(doc_data)
                            except Exception as e:
                                print(f"Sync flash error for {doc_id}: {e}")

            except Exception as e:
                print(f"Sync to cloud error: {e}")

    def cleanup_expired_cache(self):
        """Clean up expired cache files"""
        try:
            current_time = time.time()

            for filename in os.listdir(self.cache_dir):
                if filename.endswith('.json'):
                    filepath = os.path.join(self.cache_dir, filename)
                    try:
                        with open(filepath, 'r') as f:
                            data = json.load(f)

                        timestamp = data.get('_cache_timestamp', 0)
                        max_age = data.get('_cache_max_age', 3600)

                        if current_time - timestamp > max_age:
                            os.remove(filepath)

                    except Exception:
                        # Remove corrupted cache files
                        try:
                            os.remove(filepath)
                        except:
                            pass

        except Exception as e:
            print(f"Cache cleanup error: {e}")

    def clear_cache(self, collection: str = None):
        """Clear cache files"""
        try:
            if collection:
                # Clear specific collection
                if collection == 'qc_results':
                    pattern = 'qc_results_*.json'
                elif collection == 'flash_logs':
                    pattern = 'flash_logs_*.json'
                else:
                    pattern = f"{collection}*.json"

                for filename in os.listdir(self.cache_dir):
                    if filename.startswith(collection):
                        os.remove(os.path.join(self.cache_dir, filename))
            else:
                # Clear all cache
                for filename in os.listdir(self.cache_dir):
                    if filename.endswith('.json'):
                        os.remove(os.path.join(self.cache_dir, filename))

        except Exception as e:
            print(f"Clear cache error: {e}")

    def shutdown(self):
        """Shutdown the cache manager"""
        self.stop_sync = True
        if self.sync_thread.is_alive():
            self.sync_thread.join(timeout=5)

# Global instance
cache_manager = CacheManager(cache_dir=".dinocore_cache", mode=CacheMode.OFFLINE_FIRST)

def get_cache_manager() -> CacheManager:
    """Get the global cache manager instance"""
    return cache_manager

def init_cache_system(firebase_db):
    """Initialize cache system with Firebase"""
    cache_manager.set_firebase_db(firebase_db)

if __name__ == "__main__":
    # Test cache functionality
    cache = CacheManager()
    print("Cache manager initialized")
