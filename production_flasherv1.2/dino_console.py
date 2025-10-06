#!/usr/bin/env python3
"""
DinoCore Console Flasher
Interactive command console for ESP32-S3 firmware flashing and management
"""

import subprocess
import sys
import time
import os
import serial
import requests
import json
import argparse
import glob
import platform
import threading
from serial.tools import miniterm
from serial.tools.list_ports import comports
import readline
import atexit

# Import local updater module
try:
    from updater import DinoUpdater
    UPDATE_SYSTEM_AVAILABLE = True
except ImportError:
    UPDATE_SYSTEM_AVAILABLE = False
    print("⚠️  Update system not available - updater.py not found")

# Configuration
FLASH_BAUD = "460800"
MONITOR_BAUD = 115200
DINOCORE_BASE_URL = "https://dinocore-telemetry-production.up.railway.app/"  # Default to production
FIRMWARE_DIR = "production_firmware"
TESTING_FIRMWARE_DIR = "testing_firmware"
BOOTLOADER = os.path.join(FIRMWARE_DIR, "bootloader.bin")
APP = os.path.join(FIRMWARE_DIR, "magical-toys.bin")
PARTITION_TABLE = os.path.join(FIRMWARE_DIR, "partition-table.bin")
OTA_DATA = os.path.join(FIRMWARE_DIR, "ota_data_initial.bin")
TESTING_BOOTLOADER = os.path.join(TESTING_FIRMWARE_DIR, "bootloader.bin")
TESTING_APP = os.path.join(TESTING_FIRMWARE_DIR, "magical-toys.bin")
TESTING_PARTITION_TABLE = os.path.join(TESTING_FIRMWARE_DIR, "partition-table.bin")
TESTING_OTA_DATA = os.path.join(TESTING_FIRMWARE_DIR, "ota_data_initial.bin")

# Global state
current_production_firmware_info = None
current_testing_firmware_info = None
command_history = []

class DinoConsole:
    def __init__(self, use_local=False, hardware_version=None):
        self.running = True
        self.history_file = os.path.expanduser("~/.dino_console_history")
        self.use_local = use_local
        self.base_url = "http://localhost:8000" if use_local else DINOCORE_BASE_URL
        self.devices_cache = []  # Cache for device list
        self.hardware_version = hardware_version
        self.loading_active = False
        self.loading_thread = None
        
        # Clear firmware cache if hardware version changed (stored in a file)
        self.check_hardware_version_change()

        self.setup_readline()

        # Auto-check for updates on startup (optional feature)
        self.check_updates_on_startup = True  # Can be disabled in future config
        self.update_notification_showed = False
        self.update_available_info = None

        if self.check_updates_on_startup and UPDATE_SYSTEM_AVAILABLE:
            self.background_update_check()
        
    def show_loading_animation(self, message="Processing"):
        """Show a loading animation in a separate thread"""
        self.loading_active = True
        animation_chars = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
        i = 0
        
        while self.loading_active:
            print(f"\r{animation_chars[i]} {message}...", end="", flush=True)
            time.sleep(0.1)
            i = (i + 1) % len(animation_chars)
        
        # Clear the loading line
        print("\r" + " " * (len(message) + 10) + "\r", end="", flush=True)
        
    def start_loading(self, message="Processing"):
        """Start the loading animation in a background thread"""
        self.loading_thread = threading.Thread(target=self.show_loading_animation, args=(message,))
        self.loading_thread.daemon = True
        self.loading_thread.start()
        
    def stop_loading(self):
        """Stop the loading animation"""
        self.loading_active = False
        if self.loading_thread:
            self.loading_thread.join(timeout=1)
            self.loading_thread = None
        
    def check_hardware_version_change(self):
        """Check if hardware version changed and clear cache if needed"""
        version_file = os.path.join(FIRMWARE_DIR, ".last_hardware_version")
        
        # Create firmware directory if it doesn't exist
        os.makedirs(FIRMWARE_DIR, exist_ok=True)
        
        # Read the last used hardware version
        last_version = None
        if os.path.exists(version_file):
            try:
                with open(version_file, 'r') as f:
                    last_version = f.read().strip()
            except Exception:
                pass
        
        # If hardware version changed, clear the cache
        if last_version and last_version != self.hardware_version:
            print(f"🔄 Hardware version changed from {last_version} to {self.hardware_version}")
            print("Clearing production firmware cache...")
            self.clear_firmware_cache()
            self.clear_testing_firmware_cache()
        
        # Save current hardware version
        try:
            with open(version_file, 'w') as f:
                f.write(self.hardware_version)
        except Exception as e:
            print(f"Warning: Could not save hardware version: {e}")
        
    def setup_readline(self):
        """Setup readline for command history"""
        try:
            readline.read_history_file(self.history_file)
        except (FileNotFoundError, PermissionError):
            pass
        
        try:
            atexit.register(readline.write_history_file, self.history_file)
        except Exception:
            pass
        
        # Enable tab completion
        try:
            readline.parse_and_bind("tab: complete")
        except Exception:
            pass
        
    def print_banner(self):
        """Print the console banner"""
        print("=" * 60)
        print("🦕 DinoCore Console Flasher")
        print("=" * 60)
        print(f"Server: {self.base_url}")
        print(f"Hardware Version: {self.hardware_version}")
        print(f"Production Firmware: {FIRMWARE_DIR}")
        print(f"Testing Firmware: {TESTING_FIRMWARE_DIR}")
        print("Type 'help' for available commands")
        print("Type 'exit' or 'quit' to exit")
        print("=" * 60)
        
    def get_help_text(self):
        """Return help text for all commands"""
        update_status = "✅" if UPDATE_SYSTEM_AVAILABLE else "❌"
        return f"""
Available Commands:
  help                      - Show this help message
  exit, quit                - Exit the console
  devices                   - List all connected ESP32 devices, can use port number
  check testing             - Check for newest testing firmware version
  check production          - Check for newest production firmware version
  check update              - Check for application updates from GitHub {update_status}
  update                    - Install application updates from GitHub {update_status}
  flash testing <port>      - Flash testing firmware to device if available
  flash production <port>   - Flash production firmware to device (IRREVERSIBLE!)
  burn efuse <port>         - Burn hardware version to eFuse
  read efuse <port>         - Read eFuse values on device
  monitor <port>            - Open serial monitor for device

Update Commands:
  check update              - Check if newer version is available on GitHub
  update                    - Download and install the latest version

Typical usage:
  devices                                  (List all connected ESP32 devices)
  check update                             (Check for app updates)
  update                                   (Install latest version)
  flash testing 1                          (Test the testing firmware)
  burn efuse 1                             (Burn hardware version to eFuse)
  flash production 1                       (Flash production firmware. You should see encryption logs, the device will reboot, then saying no more logs)

"""

    def get_devices(self):
        """Get all connected ESP32 devices (internal method)"""
        devices = []
        
        # Get all serial ports
        ports = comports()
        
        # Also check for common device patterns on different platforms
        platform_patterns = {
            'darwin': ['/dev/cu.usbmodem*', '/dev/cu.*', '/dev/tty.usbmodem*', '/dev/tty.*'],  # macOS
            'win32': ['COM*'],  # Windows
            'linux': ['/dev/ttyUSB*', '/dev/ttyACM*']  # Linux
        }
        
        current_platform = sys.platform
        if current_platform.startswith('linux'):
            platform_key = 'linux'
        elif current_platform == 'darwin':
            platform_key = 'darwin'
        elif current_platform == 'win32':
            platform_key = 'win32'
        else:
            platform_key = 'linux'  # Default
        
        # Get platform-specific device patterns
        patterns = platform_patterns.get(platform_key, [])
        
        # Check serial ports from comports
        for port in ports:
            # More comprehensive ESP32 device detection
            description_lower = port.description.lower()
            hwid_lower = port.hwid.lower()
            
            # Check for ESP32-related keywords in description or hardware ID
            esp32_keywords = [
                'esp32', 'esp32s3', 'esp32s2', 'esp32c3',
                'usb serial', 'ch340', 'cp210', 'ftdi',
                'usbmodem', 'usbserial', 'serial'
            ]
            
            if any(keyword in description_lower or keyword in hwid_lower for keyword in esp32_keywords):
                devices.append({
                    'port': port.device,
                    'description': port.description,
                    'hwid': port.hwid,
                    'source': 'comports'
                })
        
        # Check platform-specific device patterns
        for pattern in patterns:
            try:
                if current_platform == 'win32':
                    # Windows: use glob for COM ports
                    import glob
                    found_ports = glob.glob(pattern)
                else:
                    # Unix-like: use glob for device files
                    found_ports = glob.glob(pattern)
                
                for port_path in found_ports:
                    # Skip Bluetooth devices on macOS
                    if current_platform == 'darwin' and 'Bluetooth' in port_path:
                        continue
                    
                    # Check if this port is already in our list
                    if not any(d['port'] == port_path for d in devices):
                        # Try to get additional info if possible
                        try:
                            # For Unix systems, try to get device info
                            if current_platform != 'win32':
                                import subprocess
                                result = subprocess.run(['ls', '-la', port_path], 
                                                      capture_output=True, text=True)
                                if result.returncode == 0:
                                    # Try to get more specific device info
                                    try:
                                        # Check if it's a USB device
                                        usb_result = subprocess.run(['system_profiler', 'SPUSBDataType'], 
                                                                   capture_output=True, text=True)
                                        if usb_result.returncode == 0 and 'usbmodem' in port_path.lower():
                                            devices.append({
                                                'port': port_path,
                                                'description': f'USB Serial Device ({port_path})',
                                                'hwid': f'USB Device - Platform: {current_platform}',
                                                'source': 'filesystem'
                                            })
                                        else:
                                            devices.append({
                                                'port': port_path,
                                                'description': f'Serial device ({port_path})',
                                                'hwid': f'Platform: {current_platform}',
                                                'source': 'filesystem'
                                            })
                                    except Exception:
                                        devices.append({
                                            'port': port_path,
                                            'description': f'Serial device ({port_path})',
                                            'hwid': f'Platform: {current_platform}',
                                            'source': 'filesystem'
                                        })
                            else:
                                # Windows: just add the COM port
                                devices.append({
                                    'port': port_path,
                                    'description': f'Serial device ({port_path})',
                                    'hwid': f'Platform: {current_platform}',
                                    'source': 'filesystem'
                                })
                        except Exception:
                            # If we can't get additional info, still add the device
                            devices.append({
                                'port': port_path,
                                'description': f'Serial device ({port_path})',
                                'hwid': f'Platform: {current_platform}',
                                'source': 'filesystem'
                            })
            except Exception as e:
                # Silently continue if pattern matching fails
                continue
        
        return devices

    def resolve_device(self, device_spec):
        """Resolve device specification to port name"""
        # If it's already a port name, return it
        if device_spec.startswith('/dev/') or device_spec.startswith('COM'):
            return device_spec
        
        # Try to parse as a number
        try:
            device_num = int(device_spec)
            if not self.devices_cache:
                # Refresh device cache
                self.devices_cache = self.get_devices()
            
            if 1 <= device_num <= len(self.devices_cache):
                return self.devices_cache[device_num - 1]['port']
            else:
                print(f"❌ Device number {device_num} not found. Available devices: 1-{len(self.devices_cache)}")
                return None
        except ValueError:
            print(f"❌ Invalid device specification: {device_spec}")
            print("Use device number (1, 2, 3...) or full port name (/dev/cu.usbmodem1101, COM3, etc.)")
            return None

    def list_devices(self):
        """List all connected ESP32 devices"""
        print("\n=== Connected ESP32 Devices ===")
        
        devices = self.get_devices()
        
        if not devices:
            print("❌ No ESP32 devices found")
            print("\nTroubleshooting:")
            print("  - Make sure device is connected via USB")
            print("  - Try unplugging and reconnecting the device")
            print("  - Check if drivers are installed")
            print(f"  - Platform: {sys.platform}")
            return
        
        # Cache the devices for number resolution
        self.devices_cache = devices
        
        print(f"Found {len(devices)} potential ESP32 device(s):")
        for i, device in enumerate(devices, 1):
            print(f"  {i}. {device['port']}")
            print(f"     Description: {device['description']}")
            print(f"     Hardware ID: {device['hwid']}")
            print(f"     Source: {device['source']}")
            print()

    def check_firmware(self):
        """Check for newest production firmware version"""
        global current_production_firmware_info
        
        print("\n=== Production Firmware Version Check ===")
        
        # Always clear cache first to ensure fresh state
        print("🔄 Clearing production firmware cache...")
        self.clear_firmware_cache()
        
        try:
            # Get all builds from DinoCore API
            url = f"{self.base_url}/api/builds"
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            builds = response.json()
            
            if not builds:
                print("⚠️  No production builds found in DinoCore")
                print("   Production firmware flashing will not be available")
                return False
            
            # Find all compatible builds for this hardware version
            compatible_builds = []
            for build in builds:
                supported_versions = build.get('supported_versions', [])
                if self.hardware_version in supported_versions:
                    compatible_builds.append(build)
            
            if not compatible_builds:
                print(f"⚠️  No compatible production firmware found for hardware version {self.hardware_version}")
                print("   Production firmware flashing will not be available")
                print("Available builds and their supported versions:")
                for build in builds:
                    versions = build.get('supported_versions', [])
                    print(f"     - {build['name']}: {', '.join(versions)}")
                return False
            
            # Sort by creation date (newest first) and get the latest
            compatible_builds.sort(key=lambda x: x['created_at'], reverse=True)
            latest_compatible_build = compatible_builds[0]
            
            # Download fresh firmware

            
            if not self.download_firmware_files(self.hardware_version):
                print("❌ Failed to download production firmware files")
                print("   Production firmware flashing will not be available")
                return False

            
            print(f"✅ Compatible production firmware found:")
            print(f"   Name: {latest_compatible_build['name']}")
            print(f"   Description: {latest_compatible_build['description']}")
            print(f"   Created: {latest_compatible_build['created_at']}")
            print(f"   Supported versions: {', '.join(latest_compatible_build.get('supported_versions', []))}")
            
            if len(compatible_builds) > 1:
                print(f"   Note: {len(compatible_builds)} compatible builds available, using newest")
            
            return True
            
        except requests.exceptions.RequestException as e:
            print(f"⚠️  Failed to check production firmware: {e}")
            print(f"   Production firmware flashing will not be available")
            print(f"   Make sure DinoCore is running at {self.base_url}")
            return False

    def check_testing_firmware(self):
        """Check for newest testing firmware version"""
        global current_testing_firmware_info
        
        print("\n=== Testing Firmware Version Check ===")

        
        # Always clear cache first to ensure fresh state
        print("🔄 Clearing testing firmware cache...")
        self.clear_testing_firmware_cache()
        
        try:
            # Get all testing builds from DinoCore API
            url = f"{self.base_url}/api/testing-builds"
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            builds = response.json()
            
            if not builds:
                print("⚠️  No testing builds found in DinoCore")
                print("   Testing firmware flashing will not be available")
                return False
            
            # Find all compatible builds for this hardware version
            compatible_builds = []
            for build in builds:
                supported_versions = build.get('supported_versions', [])
                if self.hardware_version in supported_versions:
                    compatible_builds.append(build)
            
            if not compatible_builds:
                print(f"⚠️  No compatible testing firmware found for hardware version {self.hardware_version}")
                print("   Testing firmware flashing will not be available")
                print("Available testing builds and their supported versions:")
                for build in builds:
                    versions = build.get('supported_versions', [])
                    print(f"     - {build['name']}: {', '.join(versions)}")
                return False
            
            # Sort by creation date (newest first) and get the latest
            compatible_builds.sort(key=lambda x: x['created_at'], reverse=True)
            latest_compatible_build = compatible_builds[0]
            
            
            if not self.download_testing_firmware_files(self.hardware_version):
                print("❌ Failed to download testing firmware files")
                print("   Testing firmware flashing will not be available")
                return False
            
            print(f"✅ Compatible testing firmware found:")
            print(f"   Name: {latest_compatible_build['name']}")
            print(f"   Description: {latest_compatible_build['description']}")
            print(f"   Created: {latest_compatible_build['created_at']}")
            print(f"   Supported versions: {', '.join(latest_compatible_build.get('supported_versions', []))}")
            
            if len(compatible_builds) > 1:
                print(f"   Note: {len(compatible_builds)} compatible testing builds available, using newest")
            
            return True
            
        except requests.exceptions.RequestException as e:
            print(f"⚠️  Failed to check testing firmware: {e}")
            print(f"   Testing firmware flashing will not be available")
            print(f"   Make sure DinoCore is running at {self.base_url}")
            return False


    def clear_firmware_cache(self):
        """Clear cached production firmware files to force re-download"""
        firmware_files = [BOOTLOADER, APP, PARTITION_TABLE, OTA_DATA]
        for file_path in firmware_files:
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception as e:
                    print(f"   Warning: Could not remove {file_path}: {e}")

    def clear_testing_firmware_cache(self):
        """Clear cached testing firmware files to force re-download"""
        firmware_files = [TESTING_BOOTLOADER, TESTING_APP, TESTING_PARTITION_TABLE, TESTING_OTA_DATA]
        for file_path in firmware_files:
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception as e:
                    print(f"   Warning: Could not remove {file_path}: {e}")

    def parse_version(self, version_string):
        """Parse version string like '1.7.0' into major, minor, patch"""
        try:
            parts = version_string.split('.')
            if len(parts) != 3:
                raise ValueError("Version must be in format X.Y.Z")
            
            major = int(parts[0])
            minor = int(parts[1])
            patch = int(parts[2])
            
            if not (0 <= major <= 255 and 0 <= minor <= 255 and 0 <= patch <= 255):
                raise ValueError("Version components must be 0-255")
            
            return major, minor, patch
        except (ValueError, IndexError) as e:
            print(f"❌ Invalid version format '{version_string}': {e}")
            print("Version must be in format X.Y.Z (e.g., 1.7.0)")
            return None

    def download_firmware_files(self, hardware_version):
        """Download all required production firmware files for the specified hardware version"""
        
        # Find compatible build
        build = self.find_build_for_version(hardware_version)
        if not build:
            return False
        
        # Get build details
        build_id = build['id']
        build_name = build['name']
        
        print(f"Using build: {build_name}")
        
        # Download each file
        file_mappings = {
            'bootloader': BOOTLOADER,
            'app': APP,
            'partition_table': PARTITION_TABLE,
            'ota_initial': OTA_DATA
        }
        
        for file_type, output_path in file_mappings.items():
            if not self.download_file_from_api(build_id, file_type, output_path):
                return False
        
        print("✅ All production firmware files downloaded successfully!")
        return True

    def download_testing_firmware_files(self, hardware_version):
        """Download all required testing firmware files for the specified hardware version"""
        
        # Find compatible testing build
        build = self.find_testing_build_for_version(hardware_version)
        if not build:
            return False
        
        # Get build details
        build_id = build['id']
        build_name = build['name']
        
        print(f"Using testing build: {build_name}")
        
        # Download each file
        file_mappings = {
            'bootloader': TESTING_BOOTLOADER,
            'app': TESTING_APP,
            'partition_table': TESTING_PARTITION_TABLE,
            'ota_initial': TESTING_OTA_DATA
        }
        
        for file_type, output_path in file_mappings.items():
            if not self.download_testing_file_from_api(build_id, file_type, output_path):
                return False
        
        print("✅ All testing firmware files downloaded successfully!")
        return True

    def find_build_for_version(self, hardware_version):
        """Find the best build for the specified hardware version"""
        url = f"{self.base_url}/api/builds"
        
        try:
            response = requests.get(url)
            response.raise_for_status()
            builds = response.json()
            
            if not builds:
                print("❌ No builds found in DinoCore")
                return None
            
            # Find builds that support this hardware version
            compatible_builds = []
            for build in builds:
                supported_versions = build.get('supported_versions', [])
                if hardware_version in supported_versions:
                    compatible_builds.append(build)
            
            if not compatible_builds:
                print(f"❌ No builds found for hardware version {hardware_version}")
                print("Available builds and their supported versions:")
                for build in builds:
                    versions = build.get('supported_versions', [])
                    print(f"  - {build['name']}: {', '.join(versions)}")
                return None
            
            # Sort by creation date (newest first) and return the first compatible build
            compatible_builds.sort(key=lambda x: x['created_at'], reverse=True)
            selected_build = compatible_builds[0]
            
            print(f"Found compatible build: {selected_build['name']}")
            print(f"Supported versions: {', '.join(selected_build['supported_versions'])}")
            
            return selected_build
            
        except requests.exceptions.RequestException as e:
            print(f"❌ Failed to fetch builds from API: {e}")
            print(f"Make sure DinoCore is running at {self.base_url}")
            return None

    def find_testing_build_for_version(self, hardware_version):
        """Find the best testing build for the specified hardware version"""
        url = f"{self.base_url}/api/testing-builds"
        
        try:
            response = requests.get(url)
            response.raise_for_status()
            builds = response.json()
            
            if not builds:
                print("❌ No testing builds found in DinoCore")
                return None
            
            # Find builds that support this hardware version
            compatible_builds = []
            for build in builds:
                supported_versions = build.get('supported_versions', [])
                if hardware_version in supported_versions:
                    compatible_builds.append(build)
            
            if not compatible_builds:
                print(f"❌ No testing builds found for hardware version {hardware_version}")
                print("Available testing builds and their supported versions:")
                for build in builds:
                    versions = build.get('supported_versions', [])
                    print(f"  - {build['name']}: {', '.join(versions)}")
                return None
            
            # Sort by creation date (newest first) and return the first compatible build
            compatible_builds.sort(key=lambda x: x['created_at'], reverse=True)
            selected_build = compatible_builds[0]
            
            print(f"Found compatible testing build: {selected_build['name']}")
            print(f"Supported versions: {', '.join(selected_build['supported_versions'])}")
            
            return selected_build
            
        except requests.exceptions.RequestException as e:
            print(f"❌ Failed to fetch testing builds from API: {e}")
            print(f"Make sure DinoCore is running at {self.base_url}")
            return None

    def download_file_from_api(self, build_id, file_type, output_path):
        """Download a file from DinoCore API"""
        url = f"{self.base_url}/api/builds/{build_id}/files/{file_type}/download"
        
        try:
            # Start loading animation
            self.start_loading(f"Downloading {os.path.basename(output_path)}")
            
            response = requests.get(url, stream=True)
            response.raise_for_status()
            
            # Ensure production firmware directory exists
            os.makedirs(FIRMWARE_DIR, exist_ok=True)
            
            with open(output_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            # Stop loading animation
            self.stop_loading()
            
            # print(f"✅ Downloaded {output_path}")
            return True
            
        except requests.exceptions.RequestException as e:
            # Stop loading animation on error
            self.stop_loading()
            print(f"❌ Failed to download {output_path}: {e}")
            return False

    def download_testing_file_from_api(self, build_id, file_type, output_path):
        """Download a testing file from DinoCore API"""
        url = f"{self.base_url}/api/testing-builds/{build_id}/files/{file_type}/download"
        
        try:
            # Start loading animation
            self.start_loading(f"Downloading {os.path.basename(output_path)}")
            
            response = requests.get(url, stream=True)
            response.raise_for_status()
            
            # Ensure testing firmware directory exists
            os.makedirs(TESTING_FIRMWARE_DIR, exist_ok=True)
            
            with open(output_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            # Stop loading animation
            self.stop_loading()
            
            # print(f"✅ Downloaded {output_path}")
            return True
            
        except requests.exceptions.RequestException as e:
            # Stop loading animation on error
            self.stop_loading()
            print(f"❌ Failed to download {output_path}: {e}")
            return False

    def require_files(self):
        """Check if all required production firmware files exist"""
        missing = [p for p in [BOOTLOADER, APP, PARTITION_TABLE, OTA_DATA] if not os.path.isfile(p)]
        if missing:
            print("❌ Missing required file(s):")
            for m in missing:
                print(f"   - {m}")
            print("Run 'check production' to download the latest production firmware")
            return False
        return True

    def require_testing_files(self):
        """Check if all required testing firmware files exist"""
        missing = [p for p in [TESTING_BOOTLOADER, TESTING_APP, TESTING_PARTITION_TABLE, TESTING_OTA_DATA] if not os.path.isfile(p)]
        if missing:
            print("❌ Missing required testing file(s):")
            for m in missing:
                print(f"   - {m}")
            print("Run 'testing-firmware-check' to download the latest testing firmware")
            return False
        return True

    def flash_firmware(self, port):
        """Flash production firmware to device"""
        print(f"\n=== Production Firmware Flashing ===")
        print(f"Target device: {port}")
        print(f"Hardware version: {self.hardware_version}")
        
        # Verify all files exist
        required_files = [BOOTLOADER, APP, PARTITION_TABLE, OTA_DATA]
        missing_files = [f for f in required_files if not os.path.exists(f)]
        if missing_files:
            print("❌ Missing required files:")
            for f in missing_files:
                print(f"   - {f}")
            return False
        
        print(f"Files to flash:")
        print(f"  - Bootloader: {BOOTLOADER}")
        print(f"  - Application: {APP}")
        print(f"  - Partition Table: {PARTITION_TABLE}")
        print(f"  - OTA Initial: {OTA_DATA}")
        
        # Use `python -m esptool` to avoid PATH issues on Windows
        flash_cmd = [
            sys.executable, "-m", "esptool",
            "--chip", "esp32s3",
            "-p", port,
            "-b", FLASH_BAUD,
            "--before=default_reset",
            "--after=hard_reset",
            "write_flash",
            "--flash_mode", "dio",
            "--flash_freq", "80m",
            "--flash_size", "16MB",
            "0x0", BOOTLOADER,
            "0x260000", APP,
            "0x10000", PARTITION_TABLE,
            "0x15000", OTA_DATA
        ]
        
        try:
            print("\nFlashing production firmware...")
            print(f"Command: {' '.join(flash_cmd)}")
            
            # Start loading animation
            self.start_loading("Flashing production firmware")
            
            result = subprocess.run(flash_cmd, capture_output=True, text=True)
            
            # Stop loading animation
            self.stop_loading()
        except FileNotFoundError as e:
            print("❌ Could not execute esptool. Make sure esptool is installed:")
            print(f"   {sys.executable} -m pip install esptool pyserial")
            print(f"Details: {e}")
            return False

        if result.returncode != 0:
            print("❌ Flash failed!")
            
            # Check for specific USB lockout error
            if result.stderr and "No serial data received" in result.stderr:
                print("🔒 USB appears to be locked out!")
                print("   This device likely has security eFuses burned.")
                print("   The device cannot be flashed or reprogrammed via USB.")
                print("   This is expected behavior after running 'burn security'.")
            elif result.stderr:
                print(f"Error details: {result.stderr}")
            elif result.stdout:
                print(f"Error details: {result.stdout}")
            else:
                print("Unknown error occurred during flashing")
            
            return False
            
        print("✅ Production firmware flash complete!")
        return True

    def flash_testing_firmware(self, port):
        """Flash testing firmware to device"""
        print(f"\n=== Testing Firmware Flashing ===")
        print(f"Target device: {port}")
        print(f"Hardware version: {self.hardware_version}")
        
        # Verify all files exist
        required_files = [TESTING_BOOTLOADER, TESTING_APP, TESTING_PARTITION_TABLE, TESTING_OTA_DATA]
        missing_files = [f for f in required_files if not os.path.exists(f)]
        if missing_files:
            print("❌ Missing required files:")
            for f in missing_files:
                print(f"   - {f}")
            return False
        
        print(f"Files to flash:")
        print(f"  - Bootloader: {TESTING_BOOTLOADER}")
        print(f"  - Application: {TESTING_APP}")
        print(f"  - Partition Table: {TESTING_PARTITION_TABLE}")
        print(f"  - OTA Initial: {TESTING_OTA_DATA}")
        
        # Use `python -m esptool` to avoid PATH issues on Windows
        flash_cmd = [
            sys.executable, "-m", "esptool",
            "--chip", "esp32s3",
            "-p", port,
            "-b", FLASH_BAUD,
            "--before=default_reset",
            "--after=hard_reset",
            "write_flash",
            "--flash_mode", "dio",
            "--flash_freq", "80m",
            "--flash_size", "16MB",
            "0x0", TESTING_BOOTLOADER,
            "0x260000", TESTING_APP,
            "0x10000", TESTING_PARTITION_TABLE,
            "0x15000", TESTING_OTA_DATA
        ]
        
        try:
            print("\nFlashing testing firmware...")
            print(f"Command: {' '.join(flash_cmd)}")
            
            # Start loading animation
            self.start_loading("Flashing testing firmware")
            
            result = subprocess.run(flash_cmd, capture_output=True, text=True)
            
            # Stop loading animation
            self.stop_loading()
        except FileNotFoundError as e:
            print("❌ Could not execute esptool. Make sure esptool is installed:")
            print(f"   {sys.executable} -m pip install esptool pyserial")
            print(f"Details: {e}")
            return False

        if result.returncode != 0:
            print("❌ Flash failed!")
            
            # Check for specific USB lockout error
            if result.stderr and "No serial data received" in result.stderr:
                print("🔒 USB appears to be locked out!")
                print("   This device likely has security eFuses burned.")
                print("   The device cannot be flashed or reprogrammed via USB.")
                print("   This is expected behavior after running 'burn security'.")
            elif result.stderr:
                print(f"Error details: {result.stderr}")
            elif result.stdout:
                print(f"Error details: {result.stdout}")
            else:
                print("Unknown error occurred during flashing")
            
            return False
            
        print("✅ Testing firmware flash complete!")
        return True

    def burn_board_version(self, port, test_mode=False):
        """Burn the hardware version and additional data to eFuse"""
        print(f"\n=== eFuse Burning ===")
        
        parsed_version = self.parse_version(self.hardware_version)
        if not parsed_version:
            return False
            
        major, minor, patch = parsed_version
        version_value = (major << 16) | (minor << 8) | patch
        
        print(f"Hardware version: {self.hardware_version}")
        print(f"eFuse value: 0x{version_value:06X}")
        print(f"  - Major: {major}")
        print(f"  - Minor: {minor}")
        print(f"  - Patch: {patch}")
        print(f"Location: EFUSE_BLK3 (32 bytes total)")
        
        if test_mode:
            print("\n🧪 TEST MODE - No actual burning will occur")
            print("This is a dry run to verify the command would work")
        else:
            print("\n⚠️  WARNING: eFuse burning is IRREVERSIBLE!")
            print("   Once burned, this value cannot be changed.")
        
        # Try to reset the device into download mode first
        if not test_mode:
            print("\n🔄 Attempting to reset device into download mode...")
            try:
                # Use esptool to reset the device
                reset_cmd = [
                    sys.executable, "-m", "esptool",
                    "--chip", "esp32s3",
                    "-p", port,
                    "--before=default_reset",
                    "--after=hard_reset",
                    "chip_id"
                ]
                
                print(f"Reset command: {' '.join(reset_cmd)}")
                result = subprocess.run(reset_cmd, capture_output=True, text=True, timeout=10)
                
                if result.returncode == 0:
                    print("✅ Device reset successful, proceeding with eFuse burning...")
                else:
                    print("⚠️  Device reset failed, but continuing with eFuse burning...")
                    print(f"Reset error: {result.stderr}")
                    
            except subprocess.TimeoutExpired:
                print("⚠️  Device reset timed out, but continuing with eFuse burning...")
            except Exception as e:
                print(f"⚠️  Device reset error: {e}, but continuing with eFuse burning...")
        
        # Create a temporary binary file with comprehensive device data
        temp_file = "temp_version.bin"
        try:
            with open(temp_file, 'wb') as f:
                # Create a 32-byte buffer (eFuse BLOCK3 size)
                buffer = bytearray(32)
                
                # Bytes 0-2: Hardware version (24-bit, big-endian)
                buffer[0] = major   # MSB
                buffer[1] = minor   # Middle byte
                buffer[2] = patch   # LSB
                
                # Bytes 3-6: Build timestamp (32-bit Unix timestamp, little-endian)
                import time
                build_timestamp = int(time.time())
                buffer[3] = build_timestamp & 0xFF
                buffer[4] = (build_timestamp >> 8) & 0xFF
                buffer[5] = (build_timestamp >> 16) & 0xFF
                buffer[6] = (build_timestamp >> 24) & 0xFF
                
                # Byte 7: Build location (1 byte, currently 0 for our only location)
                build_location = 0
                buffer[7] = build_location
                
                # Bytes 8-31: Reserved for future use (24 bytes, set to 0)
                # These can be used for additional features in the future
                
                # Write the entire 32-byte buffer
                f.write(buffer)
            
            # Verify file size and show data
            file_size = os.path.getsize(temp_file)
            print(f"Created temporary file: {temp_file} ({file_size} bytes)")
            if file_size != 32:
                print(f"⚠️  Warning: Expected 32 bytes, got {file_size} bytes")
            
            # Show comprehensive data breakdown
            with open(temp_file, 'rb') as f:
                data = f.read(32)  # Read all 32 bytes
                
                print(f"\n📊 eFuse Data Layout (32 bytes):")
                print(f"Bytes 0-2:   Hardware Version: {data[0]:02X} {data[1]:02X} {data[2]:02X}")
                print(f"  - Version: {data[0]}.{data[1]}.{data[2]} (big-endian)")
                
                # Decode timestamp
                timestamp = data[3] | (data[4] << 8) | (data[5] << 16) | (data[6] << 24)
                from datetime import datetime
                build_date = datetime.fromtimestamp(timestamp)
                print(f"Bytes 3-6:   Build Timestamp: {data[3]:02X} {data[4]:02X} {data[5]:02X} {data[6]:02X}")
                print(f"  - Unix: {timestamp} ({build_date.strftime('%Y-%m-%d %H:%M:%S')})")
                
                # Decode build location
                build_location = data[7]
                print(f"Byte 7:      Build Location: {data[7]:02X}")
                print(f"  - Location: {build_location}")
                
                # Show reserved bytes
                reserved = ' '.join(f'{b:02X}' for b in data[8:32])
                print(f"Bytes 8-31:  Reserved: {reserved}")
                
                print(f"\n🔍 Full hex dump:")
                for i in range(0, 32, 8):
                    chunk = data[i:i+8]
                    hex_chunk = ' '.join(f'{b:02X}' for b in chunk)
                    print(f"  {i:02d}-{i+7:02d}: {hex_chunk}")
            
            # Use espefuse to burn the data to EFUSE_BLK3
            efuse_cmd = [
                sys.executable, "-m", "espefuse",
                "--chip", "esp32s3",
                "-p", port,
                "--before=default_reset",
                "--do-not-confirm",  # Auto-confirm the operation
                "burn_block_data",
                "BLOCK3",
                temp_file
            ]
            
            if test_mode:
                print(f"\nWould run command: {' '.join(efuse_cmd)}")
                print("✅ Test mode completed successfully")
                return True
            
            print("\nBurning eFuse...")
            print(f"Command: {' '.join(efuse_cmd)}")
            
            # Start loading animation
            self.start_loading("Burning eFuse")
            
            result = subprocess.run(efuse_cmd, capture_output=True, text=True)
            
            # Stop loading animation
            self.stop_loading()
            
            if result.returncode != 0:
                print(f"❌ eFuse burn failed!")
                
                # Check for specific USB lockout error
                if result.stderr and "No serial data received" in result.stderr:
                    print("🔒 USB appears to be locked out!")
                    print("   This device likely has security eFuses burned.")
                    print("   The device cannot be flashed or reprogrammed via USB.")
                    print("   This is expected behavior after running 'burn security'.")
                elif result.stderr:
                    print(f"Error: {result.stderr}")
                    print(f"Output: {result.stdout}")
                else:
                    print("Unknown error occurred during eFuse burning")
                
                return False
            
            print("✅ Hardware version burned to eFuse successfully!")
            return True
            
        except FileNotFoundError as e:
            print("❌ Could not execute espefuse. Make sure esptool is installed:")
            print(f"   {sys.executable} -m pip install esptool pyserial")
            print(f"Details: {e}")
            return False
        except Exception as e:
            print(f"❌ eFuse burn failed: {e}")
            return False
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                except:
                    pass

    def apply_security(self, port, test_mode=False):
        """Apply security settings to device"""
        print(f"\n=== Security Settings ===")
        print(f"Target device: {port}")
        
        if test_mode:
            print("\n🧪 TEST MODE - No actual security changes will be applied")
            print("This is a dry run to verify the commands would work")
        else:
            print("\n⚠️  WARNING: Security settings are IRREVERSIBLE!")
            print("   Once applied, these settings cannot be easily changed.")
            print("   This will completely disable all download modes!")
        
        # Define all security eFuses to burn (USB-related eFuses last to avoid lockout)
        security_efuses = [
            "DIS_FORCE_DOWNLOAD",                 # Disable force download (non-USB)
            "DIS_DOWNLOAD_MODE",                  # Disable download mode completely (non-USB)
            "DIS_USB_OTG_DOWNLOAD_MODE",          # Disable USB OTG download mode
            "DIS_USB_SERIAL_JTAG_DOWNLOAD_MODE"   # Disable USB serial JTAG download mode (USB - burn last!)
        ]
        
        print(f"\nWill burn {len(security_efuses)} security eFuses:")
        for i, efuse in enumerate(security_efuses, 1):
            print(f"  {i}. {efuse}")
        
        # Try to reset the device into download mode first
        if not test_mode:
            print("\n🔄 Attempting to reset device into download mode...")
            try:
                # Use esptool to reset the device
                reset_cmd = [
                    sys.executable, "-m", "esptool",
                    "--chip", "esp32s3",
                    "-p", port,
                    "--before=default_reset",
                    "--after=hard_reset",
                    "chip_id"
                ]
                
                print(f"Reset command: {' '.join(reset_cmd)}")
                result = subprocess.run(reset_cmd, capture_output=True, text=True, timeout=10)
                
                if result.returncode == 0:
                    print("✅ Device reset successful, proceeding with security burning...")
                else:
                    print("⚠️  Device reset failed, but continuing with security burning...")
                    print(f"Reset error: {result.stderr}")
                    
            except subprocess.TimeoutExpired:
                print("⚠️  Device reset timed out, but continuing with security burning...")
            except Exception as e:
                print(f"⚠️  Device reset error: {e}, but continuing with security burning...")
        
        if test_mode:
            print(f"\nWould run the following commands:")
            for efuse in security_efuses:
                cmd = [
                    sys.executable, "-m", "espefuse",
                    "--chip", "esp32s3",
                    "-p", port,
                    "--before=default_reset",
                    "--do-not-confirm",  # Auto-confirm the operation
                    "burn_efuse",
                    efuse,
                    "1"
                ]
                print(f"  {' '.join(cmd)}")
            print("✅ Test mode completed successfully")
            return True
        
        print("\nApplying security settings...")
        
        # Burn each eFuse
        for i, efuse in enumerate(security_efuses, 1):
            print(f"\nBurning eFuse {i}/{len(security_efuses)}: {efuse}")
            
            security_cmd = [
                sys.executable, "-m", "espefuse",
                "--chip", "esp32s3",
                "-p", port,
                "--before=default_reset",
                "--do-not-confirm",  # Auto-confirm the operation
                "burn_efuse",
                efuse,
                "1"
            ]
            
            print(f"Command: {' '.join(security_cmd)}")
            
            try:
                # Start loading animation
                self.start_loading(f"Burning {efuse}")
                
                result = subprocess.run(security_cmd, capture_output=True, text=True)
                
                # Stop loading animation
                self.stop_loading()
                
                if result.returncode != 0:
                    print(f"❌ Failed to burn {efuse}!")
                    
                    # Check for specific USB lockout error
                    if result.stderr and "No serial data received" in result.stderr:
                        print("🔒 USB appears to be locked out!")
                        print("   This device likely has security eFuses burned.")
                        print("   The device cannot be flashed or reprogrammed via USB.")
                        print("   This is expected behavior after running 'burn security'.")
                    elif result.stderr:
                        print(f"Error: {result.stderr}")
                        print(f"Output: {result.stdout}")
                    else:
                        print("Unknown error occurred during security eFuse burning")
                    
                    return False
                
                print(f"✅ {efuse} burned successfully!")
                
            except FileNotFoundError as e:
                print("❌ Could not execute espefuse. Make sure esptool is installed:")
                print(f"   {sys.executable} -m pip install esptool pyserial")
                print(f"Details: {e}")
                return False
            except Exception as e:
                print(f"❌ Failed to burn {efuse}: {e}")
                return False
        
        print(f"\n✅ All {len(security_efuses)} security eFuses burned successfully!")
        print("⚠️  WARNING: All download modes are now disabled!")
        print("   This device can no longer be flashed or reprogrammed via USB.")
        return True

    def check_efuse(self, port):
        """Check eFuse values on device"""
        print(f"\n=== eFuse Check ===")
        print(f"Target device: {port}")
        
        # Check if device is accessible
        print("🔄 Checking device accessibility...")
        try:
            # Use esptool to check chip ID first
            chip_cmd = [
                sys.executable, "-m", "esptool",
                "--chip", "esp32s3",
                "-p", port,
                "--before=default_reset",
                "chip_id"
            ]
            
            print(f"Chip check command: {' '.join(chip_cmd)}")
            result = subprocess.run(chip_cmd, capture_output=True, text=True, timeout=10)
            
            if result.returncode != 0:
                print("❌ Could not access device!")
                if result.stderr and "No serial data received" in result.stderr:
                    print("🔒 USB appears to be locked out!")
                    print("   This device likely has security eFuses burned.")
                    print("   The device cannot be accessed via USB.")
                    print("   This is expected behavior after running security commands.")
                elif result.stderr:
                    print(f"Error: {result.stderr}")
                return False
            
            print("✅ Device accessible, reading eFuse values...")
            
        except subprocess.TimeoutExpired:
            print("❌ Device access timed out")
            return False
        except FileNotFoundError as e:
            print("❌ Could not execute esptool. Make sure esptool is installed:")
            print(f"   {sys.executable} -m pip install esptool pyserial")
            print(f"Details: {e}")
            return False
        except Exception as e:
            print(f"❌ Device access failed: {e}")
            return False
        
        # Read BLOCK_USR_DATA (BLOCK3) - User space data
        print("\n📊 Reading User Space Data (BLOCK3)...")
        try:
            # Use summary command to get user data
            summary_cmd = [
                sys.executable, "-m", "espefuse",
                "--chip", "esp32s3",
                "-p", port,
                "--before=default_reset",
                "summary"
            ]
            
            result = subprocess.run(summary_cmd, capture_output=True, text=True, timeout=15)
            
            if result.returncode != 0:
                print("❌ Failed to read eFuse data!")
                if result.stderr and "No serial data received" in result.stderr:
                    print("🔒 USB appears to be locked out!")
                    print("   This device likely has security eFuses burned.")
                    print("   The device cannot be accessed via USB.")
                elif result.stderr:
                    print(f"Error: {result.stderr}")
                return False
            
            # Parse the output to extract BLOCK_USR_DATA
            output_lines = result.stdout.split('\n')
            usr_data = None
            
            for line in output_lines:
                if 'BLOCK_USR_DATA' in line:
                    # Look for the next line that contains the hex data
                    line_index = output_lines.index(line)
                    if line_index + 1 < len(output_lines):
                        next_line = output_lines[line_index + 1].strip()
                        if next_line.startswith('='):
                            # Extract the hex values from the next line
                            hex_part = next_line[1:].strip()  # Remove the '=' prefix
                            # Extract just the hex values (remove R/W and other text)
                            hex_values = []
                            for word in hex_part.split():
                                if len(word) == 2 and all(c in '0123456789abcdefABCDEF' for c in word):
                                    hex_values.append(word)
                            if hex_values:
                                usr_data = ' '.join(hex_values)
                            break
            
            if usr_data:
                # Parse the 32-byte block data
                try:
                    # Convert hex string to bytes
                    hex_bytes = usr_data.replace(' ', '')
                    data_bytes = bytes.fromhex(hex_bytes)
                    
                    if len(data_bytes) >= 8:  # We need at least 8 bytes for our data
                        print(f"📋 Hardware Version Data:")
                        
                        # Bytes 0-2: Hardware version (big-endian)
                        major = data_bytes[0]
                        minor = data_bytes[1]
                        patch = data_bytes[2]
                        version = f"{major}.{minor}.{patch}"
                        
                        print(f"  Hardware Version: {version}")
                        
                        # Bytes 3-6: Build timestamp (little-endian)
                        timestamp = (data_bytes[3] | 
                                   (data_bytes[4] << 8) | 
                                   (data_bytes[5] << 16) | 
                                   (data_bytes[6] << 24))
                        
                        if timestamp > 0:
                            from datetime import datetime
                            build_date = datetime.fromtimestamp(timestamp)
                            print(f"  Build Timestamp: {build_date.strftime('%Y-%m-%d %H:%M:%S')}")
                        else:
                            print(f"  Build Timestamp: Not set")
                        
                        # Byte 7: Build location
                        build_location = data_bytes[7]
                        print(f"  Build Location: {build_location}")
                        
                        # Check if this matches expected hardware version
                        if self.hardware_version == version:
                            print(f"  ✅ Version matches expected: {self.hardware_version}")
                        else:
                            print(f"  ⚠️  Version mismatch - Expected: {self.hardware_version}, Found: {version}")
                        
                        # Check reserved bytes
                        if len(data_bytes) > 8:
                            reserved = data_bytes[8:32]
                            if any(b != 0 for b in reserved):
                                print(f"  ⚠️  Some reserved bytes are non-zero")
                            else:
                                print(f"  ✅ All reserved bytes are zero (as expected)")
                        
                    else:
                        print(f"⚠️  Insufficient data in BLOCK_USR_DATA (got {len(data_bytes)} bytes, need 8+)")
                        
                except Exception as e:
                    print(f"⚠️  Could not parse BLOCK_USR_DATA: {e}")
                    print(f"Raw data: {usr_data}")
            else:
                print("⚠️  Could not find BLOCK_USR_DATA in output")
                print("This might indicate the eFuse has not been burned yet")
            
        except subprocess.TimeoutExpired:
            print("❌ eFuse read timed out")
            return False
        except Exception as e:
            print(f"❌ Failed to read eFuse data: {e}")
            return False
        
        # Check security eFuses
        print("\n🔒 Checking Security eFuses...")
        security_efuses = [
            "DIS_FORCE_DOWNLOAD",
            "DIS_DOWNLOAD_MODE", 
            "DIS_USB_OTG_DOWNLOAD_MODE",
            "DIS_USB_SERIAL_JTAG_DOWNLOAD_MODE"
        ]
        
        for efuse in security_efuses:
            try:
                efuse_cmd = [
                    sys.executable, "-m", "espefuse",
                    "--chip", "esp32s3",
                    "-p", port,
                    "--before=default_reset",
                    "summary"
                ]
                
                result = subprocess.run(efuse_cmd, capture_output=True, text=True, timeout=10)
                
                if result.returncode == 0:
                    # Look for the specific eFuse in the output
                    output_lines = result.stdout.split('\n')
                    efuse_found = False
                    
                    for line in output_lines:
                        if efuse in line:
                            efuse_found = True
                            # Extract the value
                            if '1' in line:
                                print(f"  {efuse}: 🔒 BURNED (Security enabled)")
                            elif '0' in line:
                                print(f"  {efuse}: 🔓 NOT BURNED (Security disabled)")
                            else:
                                print(f"  {efuse}: ❓ UNKNOWN STATE")
                            break
                    
                    if not efuse_found:
                        print(f"  {efuse}: ❓ NOT FOUND in eFuse summary")
                        
                else:
                    print(f"  {efuse}: ❌ Could not read")
                    
            except Exception as e:
                print(f"  {efuse}: ❌ Error reading: {e}")
        
        print(f"\n✅ eFuse check completed for device {port}")
        return True

    def open_monitor(self, port):
        """Open serial monitor for device"""
        print(f"\n=== Serial Monitor ===")
        print(f"Opening monitor on {port} at {MONITOR_BAUD} baud")
        print("Press Ctrl+] then 'q' to quit the monitor")
        
        # Retry open for a few seconds; Windows can keep the handle busy after RTS reset
        start = time.time()
        last_err = None
        while time.time() - start < 8.0:
            try:
                ser = serial.serial_for_url(port, MONITOR_BAUD, do_not_open=True)
                ser.timeout = 1.0  # Increased timeout
                ser.write_timeout = 1.0  # Add write timeout
                ser.rtscts = False  # Disable hardware flow control
                ser.dsrdtr = False  # Disable hardware flow control
                ser.xonxoff = False  # Disable software flow control
                ser.open()
                break
            except Exception as e:
                last_err = e
                time.sleep(0.3)
        else:
            print(f"❌ Couldn't open {port}: {last_err}")
            print("Tips:")
            print("  - Close any app using the port (Arduino IDE, another terminal, etc.).")
            print("  - Try unplug/replug the USB cable once.")
            print("  - Check if the device is in download mode or running production firmware")
            return False

        # Use simple monitor instead of miniterm to avoid threading issues
        print("Using simple serial monitor (press Ctrl+C to exit)")
        print("Note: This monitor is more stable but has limited features")
        
        try:
            while True:
                try:
                    # Check if data is available
                    if ser.in_waiting > 0:
                        data = ser.read(ser.in_waiting)
                        if data:
                            # Decode and print the data
                            try:
                                decoded = data.decode('utf-8', errors='replace')
                                print(decoded, end='', flush=True)
                            except UnicodeDecodeError:
                                # Fallback for non-UTF8 data
                                print(data.hex(), end='', flush=True)
                    else:
                        # Small delay to prevent busy waiting
                        time.sleep(0.01)
                        
                except serial.serialutil.SerialException as e:
                    if "device reports readiness to read but returned no data" in str(e):
                        # This is a common issue with ESP32 devices, just continue
                        time.sleep(0.1)
                        continue
                    else:
                        print(f"\n⚠️  Serial error: {e}")
                        print("Device may have disconnected or been reset")
                        break
                except Exception as e:
                    print(f"\n⚠️  Unexpected error: {e}")
                    break
                    
        except KeyboardInterrupt:
            print("\nExiting monitor...")
        except Exception as e:
            print(f"\n⚠️  Monitor error: {e}")
            print("This is usually harmless and can be ignored.")
        finally:
            try:
                ser.close()
            except Exception:
                pass
        
        return True



    def parse_command(self, command_line):
        """Parse command line and execute appropriate function"""
        if not command_line.strip():
            return
        
        parts = command_line.strip().split()
        command = parts[0].lower()
        args = parts[1:]
        
        try:
            if command in ['help', 'h']:
                print(self.get_help_text())
                
            elif command in ['exit', 'quit', 'q']:
                print("Goodbye! 👋")
                self.running = False
                
            elif command in ['devices', 'device', 'd']:
                self.list_devices()
                
            elif command in ['check', 'c']:
                if len(args) < 1:
                    print("❌ Usage: check <production|testing|update> [port]")
                    return
                subcommand = args[0].lower()

                if subcommand in ['production', 'testing']:
                    if subcommand == 'production':
                        self.check_firmware()
                    elif subcommand == 'testing':
                        self.check_testing_firmware()
                elif subcommand == 'update':
                    if not UPDATE_SYSTEM_AVAILABLE:
                        print("❌ Update system not available")
                        return
                    try:
                        updater = DinoUpdater()
                        update_info = updater.check_for_updates()
                        if update_info:
                            print("🎉 Update available!"                            print(f"   Version: {update_info['version']}")
                            print(f"   Release: {update_info['release_data'].get('name', 'N/A')}")
                            if update_info['changelog']:
                                print("   Notes:"                                for line in update_info['changelog'][:200].split('\n')[:3]:
                                    if line.strip():
                                        print(f"     {line.strip()}")
                            print("   Run 'update' to install this version")
                        else:
                            print("✅ You are running the latest version!")
                    except Exception as e:
                        print(f"❌ Error checking for updates: {e}")
                else:
                    print(f"❌ Unknown check subcommand: {subcommand}")
                    print("Available subcommands: production, testing, update"
                
            elif command in ['read', 'r']:
                if len(args) < 2:
                    print("❌ Usage: read efuse <port>")
                    return
                subcommand = args[0].lower()
                port = self.resolve_device(args[1])
                if not port:
                    return
                
                if subcommand == 'efuse':
                    self.check_efuse(port)
                else:
                    print(f"❌ Unknown read subcommand: {subcommand}")
                    print("Available subcommands: efuse")
                
            elif command in ['flash', 'f']:
                if len(args) < 2:
                    print("❌ Usage: flash <production|testing> <port>")
                    return
                subcommand = args[0].lower()
                port = self.resolve_device(args[1])
                if not port:
                    return
                
                if subcommand == 'production':
                    print("⚠️  WARNING: Production firmware flashing is IRREVERSIBLE!")
                    print("   This will overwrite any existing firmware on the device.")
                    print("   Make sure you have backed up any important data.")
                    confirm = input("   Type 'YES' to continue: ")
                    if confirm != 'YES':
                        print("❌ Production firmware flashing cancelled")
                        return
                    
                    if not self.require_files():
                        print("❌ Production firmware not available")
                        print("   Run 'check production' to download production firmware")
                        return
                    
                    if self.flash_firmware(port):
                        print("\nStarting monitor immediately after flash...")
                        self.open_monitor(port)
                elif subcommand == 'testing':
                    if not self.require_testing_files():
                        print("❌ Testing firmware not available")
                        print("   Run 'check testing' to download testing firmware")
                        return
                    
                    if self.flash_testing_firmware(port):
                        print("\nStarting monitor immediately after flash...")
                        self.open_monitor(port)
                else:
                    print(f"❌ Unknown flash subcommand: {subcommand}")
                    print("Available subcommands: production, testing")
                
            elif command in ['burn', 'b']:
                if len(args) < 2:
                    print("❌ Usage: burn efuse <port> [--test]")
                    return
                subcommand = args[0].lower()
                port = self.resolve_device(args[1])
                if not port:
                    return
                test_mode = '--test' in args
                
                if subcommand == 'efuse':
                    self.burn_board_version(port, test_mode)
                else:
                    print(f"❌ Unknown burn subcommand: {subcommand}")
                    print("Available subcommands: efuse")
                
            elif command == 'update':
                if not UPDATE_SYSTEM_AVAILABLE:
                    print("❌ Update system not available")
                    return
                try:
                    updater = DinoUpdater()
                    print("🚀 Installing update...")
                    success = updater.update(auto_confirm=True if '-y' in args else False)
                    if success:
                        print("\n✅ Update completed successfully!")
                        print("🔄 Please restart the application to use the new version")
                    else:
                        print("❌ Update failed or was cancelled")
                except Exception as e:
                    print(f"❌ Update error: {e}")

            elif command in ['monitor', 'm']:
                if len(args) < 1:
                    print("❌ Usage: monitor <port>")
                    return
                port = self.resolve_device(args[0])
                if not port:
                    return
                self.open_monitor(port)

            else:
                print(f"❌ Unknown command: {command}")
                print("Type 'help' for available commands")
                
        except Exception as e:
            print(f"❌ Error executing command: {e}")

    def background_update_check(self):
        """Background thread to check for updates automatically"""
        def check_worker():
            try:
                print("\n🔄 Checking for application updates in the background...")
                updater = DinoUpdater()
                update_info = updater.check_for_updates()

                if update_info:
                    self.update_available_info = update_info
                    self.update_notification_showed = False  # Allow showing notification later
                    # Don't show notification immediately to avoid cluttering startup
                    # It will be shown when user interacts with update commands
                else:
                    print("✅ Application is up to date")

            except Exception as e:
                # Silently fail background checks to not disturb startup
                self.update_available_info = None

        # Start background thread
        update_thread = threading.Thread(target=check_worker, daemon=True)
        update_thread.start()

    def show_update_notification(self):
        """Show update notification if available and not shown yet"""
        if self.update_available_info and not self.update_notification_showed:
            update_info = self.update_available_info
            print(f"\n🎉 Update Available: v{update_info['version']}")
            print(f"   Release: {update_info['release_data'].get('name', 'New Version')}")
            if update_info['changelog']:
                print("   Notes:"                for line in update_info['changelog'][:150].split('\n')[:2]:
                    if line.strip():
                        print(f"     {line.strip()}")
            print("   💡 Run 'update' to install the new version")
            print()
            self.update_notification_showed = True

    def parse_command(self, command_line):
        """Parse command line and execute appropriate function"""
        if not command_line.strip():
            return

        # Show update notification on first command if available
        if not self.update_notification_showed and self.update_available_info:
            self.show_update_notification()

        parts = command_line.strip().split()
        command = parts[0].lower()
        args = parts[1:]

        try:
            if command in ['help', 'h']:
                print(self.get_help_text())

            elif command in ['exit', 'quit', 'q']:
                print("Goodbye! 👋")
                self.running = False

            elif command in ['devices', 'device', 'd']:
                self.list_devices()

            elif command in ['check', 'c']:
                if len(args) < 1:
                    print("❌ Usage: check <production|testing|update> [port]")
                    return
                subcommand = args[0].lower()

                if subcommand in ['production', 'testing']:
                    if subcommand == 'production':
                        self.check_firmware()
                    elif subcommand == 'testing':
                        self.check_testing_firmware()
                elif subcommand == 'update':
                    if not UPDATE_SYSTEM_AVAILABLE:
                        print("❌ Update system not available")
                        return
                    try:
                        updater = DinoUpdater()
                        update_info = updater.check_for_updates()
                        if update_info:
                            print("🎉 Update available!"
                            print(f"   Version: {update_info['version']}")
                            print(f"   Release: {update_info['release_data'].get('name', 'N/A')}")
                            if update_info['changelog']:
                                print("   Notes:"
                                for line in update_info['changelog'][:200].split('\n')[:3]:
                                    if line.strip():
                                        print(f"     {line.strip()}")
                            print("   Run 'update' to install this version")
                        else:
                            print("✅ You are running the latest version!")
                    except Exception as e:
                        print(f"❌ Error checking for updates: {e}")
                else:
                    print(f"❌ Unknown check subcommand: {subcommand}")
                    print("Available subcommands: production, testing, update"

            elif command in ['read', 'r']:
                if len(args) < 2:
                    print("❌ Usage: read efuse <port>")
                    return
                subcommand = args[0].lower()
                port = self.resolve_device(args[1])
                if not port:
                    return

                if subcommand == 'efuse':
                    self.check_efuse(port)
                else:
                    print(f"❌ Unknown read subcommand: {subcommand}")
                    print("Available subcommands: efuse")

            elif command in ['flash', 'f']:
                if len(args) < 2:
                    print("❌ Usage: flash <production|testing> <port>")
                    return
                subcommand = args[0].lower()
                port = self.resolve_device(args[1])
                if not port:
                    return

                if subcommand == 'production':
                    print("⚠️  WARNING: Production firmware flashing is IRREVERSIBLE!")
                    print("   This will overwrite any existing firmware on the device.")
                    print("   Make sure you have backed up any important data.")
                    confirm = input("   Type 'YES' to continue: ")
                    if confirm != 'YES':
                        print("❌ Production firmware flashing cancelled")
                        return

                    if not self.require_files():
                        print("❌ Production firmware not available")
                        print("   Run 'check production' to download production firmware")
                        return

                    if self.flash_firmware(port):
                        print("\nStarting monitor immediately after flash...")
                        self.open_monitor(port)
                elif subcommand == 'testing':
                    if not self.require_testing_files():
                        print("❌ Testing firmware not available")
                        print("   Run 'check testing' to download testing firmware")
                        return

                    if self.flash_testing_firmware(port):
                        print("\nStarting monitor immediately after flash...")
                        self.open_monitor(port)
                else:
                    print(f"❌ Unknown flash subcommand: {subcommand}")
                    print("Available subcommands: production, testing")

            elif command in ['burn', 'b']:
                if len(args) < 2:
                    print("❌ Usage: burn efuse <port> [--test]")
                    return
                subcommand = args[0].lower()
                port = self.resolve_device(args[1])
                if not port:
                    return
                test_mode = '--test' in args

                if subcommand == 'efuse':
                    self.burn_board_version(port, test_mode)
                else:
                    print(f"❌ Unknown burn subcommand: {subcommand}")
                    print("Available subcommands: efuse")

            elif command == 'update':
                if not UPDATE_SYSTEM_AVAILABLE:
                    print("❌ Update system not available")
                    return
                try:
                    updater = DinoUpdater()
                    print("🚀 Installing update...")
                    success = updater.update(auto_confirm=True if '-y' in args else False)
                    if success:
                        print("\n✅ Update completed successfully!")
                        print("🔄 Please restart the application to use the new version")
                        self.update_available_info = None  # Clear after successful update
                    else:
                        print("❌ Update failed or was cancelled")
                except Exception as e:
                    print(f"❌ Update error: {e}")

            elif command in ['monitor', 'm']:
                if len(args) < 1:
                    print("❌ Usage: monitor <port>")
                    return
                port = self.resolve_device(args[0])
                if not port:
                    return
                self.open_monitor(port)

            else:
                print(f"❌ Unknown command: {command}")
                print("Type 'help' for available commands")

        except Exception as e:
            print(f"❌ Error executing command: {e}")

    def run(self):
        """Main console loop"""
        self.print_banner()

        while self.running:
            try:
                command = input("============================================================\n\n🦕 dino> ").strip()
                if command:
                    command_history.append(command)
                    self.parse_command(command)
            except KeyboardInterrupt:
                print("\n\nUse 'exit' or 'quit' to exit the console")
            except EOFError:
                print("\nGoodbye! 👋")
                break

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='DinoCore Console Flasher')
    parser.add_argument('hardware_version', 
                       help='Hardware version (e.g., 1.7.0)')
    parser.add_argument('--local', action='store_true', 
                       help='Use local DinoCore server (localhost:8000) instead of production')
    
    args = parser.parse_args()
    
    # Validate hardware version format
    console = DinoConsole(use_local=args.local, hardware_version=args.hardware_version)
    
    # Check firmware compatibility on startup (optional)
    console.check_firmware()
    console.check_testing_firmware()
    
    console.run()

if __name__ == "__main__":
    main()
