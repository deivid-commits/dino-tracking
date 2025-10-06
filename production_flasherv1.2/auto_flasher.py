
import os
import sys
import time
import subprocess
import requests
import winsound
from serial.tools.list_ports import comports

# --- Configuration ---
HARDWARE_VERSION = "1.9.0"
DINOCORE_BASE_URL = "https://dinocore-telemetry-production.up.railway.app/"
FIRMWARE_DIR = "production_firmware"
BOOTLOADER = os.path.join(FIRMWARE_DIR, "bootloader.bin")
APP = os.path.join(FIRMWARE_DIR, "magical-toys.bin")
PARTITION_TABLE = os.path.join(FIRMWARE_DIR, "partition-table.bin")
OTA_DATA = os.path.join(FIRMWARE_DIR, "ota_data_initial.bin")
FLASH_BAUD = "460800"

# --- Sound Definitions ---
START_FREQ = 800  # Hz
START_DUR = 200   # ms
END_FREQ = 1200   # Hz
END_DUR = 500     # ms
ERROR_FREQ = 400
ERROR_DUR = 1000

def play_start_sound():
    """Plays a sound to indicate the start of an operation."""
    try:
        winsound.Beep(START_FREQ, START_DUR)
    except Exception as e:
        print(f"Could not play start sound: {e}")

def play_end_sound():
    """Plays a sound to indicate the end of an operation."""
    try:
        winsound.Beep(END_FREQ, END_DUR)
    except Exception as e:
        print(f"Could not play end sound: {e}")

def play_error_sound():
    """Plays a sound to indicate an error."""
    try:
        winsound.Beep(ERROR_FREQ, ERROR_DUR)
    except Exception as e:
        print(f"Could not play error sound: {e}")

def find_build_for_version(hardware_version):
    """Find the best build for the specified hardware version."""
    url = f"{DINOCORE_BASE_URL}/api/builds"
    print(f"Searching for build compatible with version {hardware_version}...")
    try:
        response = requests.get(url)
        response.raise_for_status()
        builds = response.json()

        if not builds:
            print("[X] No builds found in DinoCore")
            return None

        compatible_builds = [b for b in builds if hardware_version in b.get('supported_versions', [])]

        if not compatible_builds:
            print(f"[X] No builds found for hardware version {hardware_version}")
            return None

        compatible_builds.sort(key=lambda x: x['created_at'], reverse=True)
        selected_build = compatible_builds[0]
        print(f"Found compatible build: {selected_build['name']}")
        return selected_build

    except requests.exceptions.RequestException as e:
        print(f"[X] Failed to fetch builds from API: {e}")
        return None

def download_file_from_api(build_id, file_type, output_path):
    """Download a file from DinoCore API."""
    url = f"{DINOCORE_BASE_URL}/api/builds/{build_id}/files/{file_type}/download"
    print(f"Downloading {os.path.basename(output_path)}...")
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        os.makedirs(FIRMWARE_DIR, exist_ok=True)
        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        print(f"[OK] Downloaded {output_path}")
        return True
    except requests.exceptions.RequestException as e:
        print(f"[X] Failed to download {output_path}: {e}")
        return False

def download_firmware_files(hardware_version):
    """Download all required production firmware files."""
    build = find_build_for_version(hardware_version)
    if not build:
        return False

    build_id = build['id']
    file_mappings = {
        'bootloader': BOOTLOADER,
        'app': APP,
        'partition_table': PARTITION_TABLE,
        'ota_initial': OTA_DATA
    }

    for file_type, output_path in file_mappings.items():
        if not download_file_from_api(build_id, file_type, output_path):
            return False

    print("[OK] All production firmware files downloaded successfully!")
    return True

def flash_firmware(port, hardware_version):
    """Flash production firmware to a device."""
    print(f"\n=== Production Firmware Flashing ===")
    print(f"Target device: {port}")
    print(f"Hardware version: {hardware_version}")

    required_files = [BOOTLOADER, APP, PARTITION_TABLE, OTA_DATA]
    if any(not os.path.exists(f) for f in required_files):
        print("[X] Missing required firmware files. Attempting to download...")
        if not download_firmware_files(hardware_version):
            print("[X] Failed to download firmware. Aborting flash.")
            return False

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
        
        process = subprocess.Popen(flash_cmd, 
                                   stdout=subprocess.PIPE, 
                                   stderr=subprocess.STDOUT, 
                                   universal_newlines=True,
                                   bufsize=1)

        for line in process.stdout:
            print(line, end='', flush=True)

        process.wait()

        if process.returncode != 0:
            print(f"\n[X] Flash failed with exit code {process.returncode}")
            play_error_sound()
            return False
        
        play_end_sound()
        print("\n[OK] Production firmware flash complete!")
        return True

    except FileNotFoundError:
        print("[X] Could not execute esptool. Make sure esptool is installed.")
        play_error_sound()
        return False
    except Exception as e:
        print(f"[X] An unexpected error occurred during flashing: {e}")
        play_error_sound()
        return False


def get_current_ports():
    """Gets a set of current serial ports."""
    return {port.device for port in comports()}

def main():
    """Main function to watch for new devices and flash them."""
    print("--- DinoCore Automatic Flasher ---")
    print(f"Hardware Version: {HARDWARE_VERSION}")
    print("Checking for firmware...")

    if not download_firmware_files(HARDWARE_VERSION):
        print("[X] Could not download initial firmware. Please check network and server status.")
        play_error_sound()
        return

    print("\nWaiting for new devices to be connected...")
    known_ports = get_current_ports()
    if known_ports:
        print(f"Ignoring already connected devices: {', '.join(known_ports)}")


    try:
        while True:
            current_ports = get_current_ports()
            new_ports = current_ports - known_ports

            for port in new_ports:
                print(f"\n>>> New device detected on: {port} <<<")
                flash_firmware(port, HARDWARE_VERSION)
                print(f"\nFinished processing {port}. Waiting for next device...")

            known_ports = current_ports
            time.sleep(2)
    except KeyboardInterrupt:
        print("\nExiting program.")

if __name__ == "__main__":
    main()
