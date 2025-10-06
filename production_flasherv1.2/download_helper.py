import requests
import os

# --- Configuration ---
VERSION = "1.9.0"
API_URL = "https://dinocore-telemetry-production.up.railway.app/api/testing-builds"
OUTPUT_DIR = "testing_firmware"

def download_firmware():
    print(f"--- Downloading testing firmware for {VERSION} ---")
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    try:
        # Find the correct build
        response = requests.get(API_URL, timeout=15)
        response.raise_for_status()
        builds = response.json()
        compatible = [b for b in builds if VERSION in b.get('supported_versions', [])]
        if not compatible:
            print(f"[X] No compatible testing firmware found for HW {VERSION}.")
            return

        latest_build = max(compatible, key=lambda x: x['created_at'])
        build_id = latest_build['id']
        print(f"Found compatible build: {latest_build['name']}")

        # Download files
        file_types = ['bootloader', 'app', 'partition_table', 'ota_initial']
        filenames = ["bootloader.bin", "magical-toys.bin", "partition-table.bin", "ota_data_initial.bin"]

        for f_type, f_name in zip(file_types, filenames):
            output_path = os.path.join(OUTPUT_DIR, f_name)
            dl_url = f"{os.path.dirname(API_URL)}/testing-builds/{build_id}/files/{f_type}/download"
            print(f"Downloading {f_name}...")
            dl_resp = requests.get(dl_url, stream=True, timeout=30)
            dl_resp.raise_for_status()
            with open(output_path, 'wb') as f:
                for chunk in dl_resp.iter_content(chunk_size=8192):
                    f.write(chunk)
        print(f"[OK] All firmware files for {VERSION} downloaded successfully to '{OUTPUT_DIR}'.")

    except requests.exceptions.RequestException as e:
        print(f"[X] Network error while downloading: {e}")

if __name__ == "__main__":
    download_firmware()
