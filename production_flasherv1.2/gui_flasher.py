import os
import sys
import time
import subprocess
import requests
import winsound
import threading
import queue
import tkinter as tk
from tkinter import scrolledtext, messagebox, ttk
from serial.tools.list_ports import comports
import re
import traceback
import serial
import configparser

# --- Configuration ---
#TARGET_HW_VERSION = "1.9.0"
DINOCORE_BASE_URL = "https://dinocore-telemetry-production.up.railway.app/"
FIRMWARE_DIR = "production_firmware"
TESTING_FIRMWARE_DIR = "testing_firmware"
FLASH_BAUD = "460800"
MONITOR_BAUD = 115200
CONFIG_FILE = "config.ini"

# --- Sound Definitions ---
START_FREQ = 800
START_DUR = 150
END_FREQ = 1200
END_DUR = 400
ERROR_FREQ = 400
ERROR_DUR = 800

# --- Config Manager ---
class ConfigManager:
    def __init__(self, file_path):
        self.file_path = file_path
        self.config = configparser.ConfigParser()
        if not os.path.exists(self.file_path):
            self.create_default_config()
        self.config.read(self.file_path)

    def create_default_config(self):
        self.config['DEFAULT'] = {'TARGET_HW_VERSION': '1.9.1'}
        with open(self.file_path, 'w') as configfile:
            self.config.write(configfile)

    def get_hw_version(self):
        return self.config.get('DEFAULT', 'TARGET_HW_VERSION', fallback='1.9.0')

    def save_hw_version(self, version):
        self.config['DEFAULT']['TARGET_HW_VERSION'] = version
        with open(self.file_path, 'w') as configfile:
            self.config.write(configfile)

# --- Helper Functions ---
def play_sound(freq, duration):
    try:
        winsound.Beep(freq, duration)
    except Exception:
        pass

# --- Business Logic ---
def parse_version(version_string):
    try:
        parts = version_string.split('.')
        if len(parts) != 3: return None
        return tuple(map(int, parts))
    except (ValueError, IndexError):
        return None

def download_firmware(log_queue, mode, hardware_version):
    log_queue.put(f"Downloading {mode} firmware for HW {hardware_version}...")
    api_path = 'builds' if mode == 'production' else 'testing-builds'
    fw_dir = FIRMWARE_DIR if mode == 'production' else TESTING_FIRMWARE_DIR
    url = f"{DINOCORE_BASE_URL}/api/{api_path}"
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        builds = response.json()
        compatible = [b for b in builds if hardware_version in b.get('supported_versions', [])]
        if not compatible:
            log_queue.put(f"[X] No compatible {mode} firmware found for HW {hardware_version}.")
            return False
        latest_build = max(compatible, key=lambda x: x['created_at'])
        build_id = latest_build['id']
        log_queue.put(f"Found compatible build: {latest_build['name']}")
        os.makedirs(fw_dir, exist_ok=True)
        file_types = ['bootloader', 'app', 'partition_table', 'ota_initial']
        filenames = ["bootloader.bin", "magical-toys.bin", "partition-table.bin", "ota_data_initial.bin"]
        for f_type, f_name in zip(file_types, filenames):
            output_path = os.path.join(fw_dir, f_name)
            dl_url = f"{DINOCORE_BASE_URL}/api/{api_path}/{build_id}/files/{f_type}/download"
            log_queue.put(f"Downloading {f_name}...")
            dl_resp = requests.get(dl_url, stream=True, timeout=30)
            dl_resp.raise_for_status()
            with open(output_path, 'wb') as f:
                for chunk in dl_resp.iter_content(chunk_size=8192):
                    f.write(chunk)
        log_queue.put(f"[OK] {mode.capitalize()} firmware for {hardware_version} downloaded successfully.")
        return True
    except requests.exceptions.RequestException as e:
        log_queue.put(f"[X] Network error while downloading: {e}")
        return False

def burn_efuse(log_queue, port, version):
    log_queue.put(f"Attempting to burn eFuse with version {version}...")
    version_parts = parse_version(version)
    if not version_parts:
        log_queue.put(f"[X] Invalid version format: {version}")
        return False

    log_queue.put("Attempting to reset device into download mode...")
    try:
        reset_cmd = [sys.executable, "-m", "esptool", "--chip", "esp32s3", "-p", port, "--before=default_reset", "--after=hard_reset", "chip_id"]
        result = subprocess.run(reset_cmd, capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            log_queue.put("Device reset successful, proceeding with eFuse burning...")
        else:
            log_queue.put("Device reset failed, but continuing with eFuse burning...")
    except Exception as e:
        log_queue.put(f"Device reset error: {e}, but continuing...")

    major, minor, patch = version_parts
    temp_file = f"temp_efuse_{port}.bin"
    try:
        with open(temp_file, 'wb') as f:
            buffer = bytearray(32)
            buffer[0], buffer[1], buffer[2] = major, minor, patch
            f.write(buffer)
        efuse_cmd = [sys.executable, "-m", "espefuse", "--chip", "esp32s3", "-p", port, "--do-not-confirm", "burn_block_data", "BLOCK3", temp_file]
        result = subprocess.run(efuse_cmd, capture_output=True, text=True, check=False)
        if result.returncode != 0:
            log_queue.put("Could not burn eFuse. It might be already written.")
            if result.stderr:
                log_queue.put(f"eFuse burn error: {result.stderr}")
            return False
        log_queue.put("[OK] eFuse burned successfully.")
        return True
    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)

def read_efuse_version(log_queue, port):
    log_queue.put(f"Attempting to read eFuse from {port}...")
    try:
        summary_cmd = [sys.executable, "-m", "espefuse", "--chip", "esp32s3", "-p", port, "summary"]
        result = subprocess.run(summary_cmd, capture_output=True, text=True, check=False, timeout=15)
        if result.returncode != 0:
            log_queue.put("[X] Failed to read eFuse. Maybe locked?")
            return None
        output = result.stdout
        match = re.search(r"BLOCK_USR_DATA \(BLOCK3\).*?=\s*([0-9a-f]{2})\s*([0-9a-f]{2})\s*([0-9a-f]{2})", output, re.DOTALL | re.IGNORECASE)
        if match:
            major, minor, patch = int(match.group(1), 16), int(match.group(2), 16), int(match.group(3), 16)
            if major == 0 and minor == 0 and patch == 0:
                log_queue.put("[!] eFuse block is empty (version 0.0.0). Treating as no version found.")
                return None
            version = f"{major}.{minor}.{patch}"
            log_queue.put(f"[OK] Found raw eFuse version: {version}")
            return version
        log_queue.put("[!] No version found on eFuse.")
        return None
    except Exception as e:
        log_queue.put(f"[X] Error reading eFuse: {e}")
        return None

def flash_device(log_queue, port, mode, hardware_version):
    log_queue.put(('show_progress',))
    play_sound(START_FREQ, START_DUR)
    log_queue.put(f"-- Starting {mode} flash for HW {hardware_version} on {port} --")
    fw_dir = FIRMWARE_DIR if mode == 'production' else TESTING_FIRMWARE_DIR
    if os.path.exists(fw_dir):
        for f in os.listdir(fw_dir):
            try:
                os.remove(os.path.join(fw_dir, f))
            except OSError:
                pass
    if not download_firmware(log_queue, mode, hardware_version):
        log_queue.put(f"[X] Download for {hardware_version} failed. Aborting flash.")
        play_sound(ERROR_FREQ, ERROR_DUR)
        log_queue.put(('hide_progress',))
        return False
    bootloader, app, p_table, ota_data = [os.path.join(fw_dir, f) for f in ["bootloader.bin", "magical-toys.bin", "partition-table.bin", "ota_data_initial.bin"]]
    flash_cmd = [sys.executable, "-m", "esptool", "--chip", "esp32s3", "-p", port, "-b", FLASH_BAUD, "--before=default_reset", "--after=hard_reset", "write_flash", "--flash_mode", "dio", "--flash_freq", "80m", "--flash_size", "16MB", "0x0", bootloader, "0x260000", app, "0x10000", p_table, "0x15000", ota_data]
    try:
        process = subprocess.Popen(flash_cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True, bufsize=1)
        is_flashing_main_app = False
        for line in iter(process.stdout.readline, ''):
            log_queue.put(line)
            if "Writing at 0x00260000" in line:
                is_flashing_main_app = True
            if is_flashing_main_app:
                match = re.search(r"([\d\.]+)\%", line)
                if match:
                    progress = int(float(match.group(1)))
                    log_queue.put(('progress', progress))
            if is_flashing_main_app and "Wrote" in line and "at 0x00260000" in line:
                is_flashing_main_app = False
        process.stdout.close()
        return_code = process.wait()
        if return_code != 0:
            log_queue.put(f"\n[X] Flash failed with exit code {return_code}.\n")
            play_sound(ERROR_FREQ, ERROR_DUR)
            return False
        else:
            log_queue.put("\n[OK] Flash successful!\n")
            play_sound(END_FREQ, END_DUR)
            return True
    except Exception as e:
        log_queue.put(f"\n[X] An unexpected error occurred during flash: {e}\n")
        play_sound(ERROR_FREQ, ERROR_DUR)
        return False
    finally:
        log_queue.put(('hide_progress',))
        log_queue.put(f"-- Finished flashing {port} --")

def serial_monitor_thread(log_queue, port, stop_event):
    try:
        ser = serial.Serial(port, MONITOR_BAUD, timeout=1)
        log_queue.put(f"--- Serial monitor started for {port} ---")
        while not stop_event.is_set():
            try:
                if ser.in_waiting > 0:
                    line = ser.readline()
                    log_queue.put(line.decode('utf-8', errors='replace'))
                else:
                    time.sleep(0.05) # Avoid busy-waiting
                    if not any(p.device == port for p in comports()):
                        log_queue.put(f"\n--- Device {port} disconnected. Closing monitor. ---")
                        break
            except serial.SerialException:
                log_queue.put(f"\n--- Device {port} disconnected. Closing monitor. ---")
                break
        ser.close()
        log_queue.put(f"--- Serial monitor for {port} stopped. ---")
    except Exception as e:
        log_queue.put(f"\n[X] Error opening serial monitor on {port}: {e}")

def process_device_thread(log_queue, port, mode, stop_event, target_hw_version):
    try:
        log_queue.put(f"--- Processing new device on {port} ---")
        flash_hw_version = None
        if mode == 'testing':
            burn_successful = burn_efuse(log_queue, port, target_hw_version)
            if burn_successful:
                log_queue.put("Burn command succeeded. Verifying by reading back eFuse...")
                time.sleep(1)
                read_version = read_efuse_version(log_queue, port)
                if read_version == target_hw_version:
                    log_queue.put(f"[OK] Verification successful. Version {read_version} is burned.")
                    flash_hw_version = target_hw_version
                else:
                    log_queue.put(f"[X] VERIFICATION FAILED. Burned version ({read_version}) does not match target ({target_hw_version}). Stopping.")
                    play_sound(ERROR_FREQ, ERROR_DUR)
            else:
                log_queue.put("Burn command failed. Attempting to read existing version...")
                existing_version = read_efuse_version(log_queue, port)
                if existing_version:
                    log_queue.put(f"Proceeding with existing version: {existing_version}")
                    flash_hw_version = existing_version
                else:
                    log_queue.put(f"[X] Could not read existing version after burn failure. Stopping.")
                    play_sound(ERROR_FREQ, ERROR_DUR)
        elif mode == 'production':
            log_queue.put("Production mode: Reading eFuse...")
            existing_version = read_efuse_version(log_queue, port)
            if existing_version:
                flash_hw_version = existing_version
            else:
                log_queue.put("[X] PRODUCTION FAILED: No eFuse version found. Please run device through Testing Mode first.")
                play_sound(ERROR_FREQ, ERROR_DUR)
        
        if flash_hw_version:
            flash_ok = flash_device(log_queue, port, mode, flash_hw_version)
            if flash_ok:
                serial_monitor_thread(log_queue, port, stop_event)

    except Exception as e:
        log_queue.put(f"!!!!!!!!!! UNEXPECTED ERROR in device processing thread !!!!!!!!!!!")
        log_queue.put(f"ERROR: {e}")
        log_queue.put(traceback.format_exc() + "\n")
        play_sound(ERROR_FREQ, ERROR_DUR)

class FlasherApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Dino Fun Flasher")
        self.root.geometry("750x650")
        self.colors = {
            'bg': '#F0F8E8', 'log_bg': '#FDF5E6', 'text': '#36454F',
            'prod_btn': '#FF6347', 'test_btn': '#4682B4', 'stop_btn': '#6B8E23',
            'status_prod': '#E57373', 'status_test': '#64B5F6', 'status_idle': '#BDBDBD'
        }
        self.root.configure(bg=self.colors['bg'])
        
        self.config_manager = ConfigManager(CONFIG_FILE)
        self.hw_version_var = tk.StringVar(value=self.config_manager.get_hw_version())
        
        self.log_queue = queue.Queue()
        self.scanner_stop_event = threading.Event()
        self.create_widgets()
        self.update_log()

    def create_widgets(self):
        main_frame = tk.Frame(self.root, bg=self.colors['bg'])
        main_frame.pack(padx=15, pady=15, fill=tk.BOTH, expand=True)

        # Version Frame
        version_frame = tk.Frame(main_frame, bg=self.colors['bg'])
        version_frame.pack(fill=tk.X, pady=(0, 10))
        tk.Label(version_frame, text="Target HW Version:", font=("Comic Sans MS", 12, "bold"), bg=self.colors['bg']).pack(side=tk.LEFT, padx=(0, 10))
        self.version_entry = tk.Entry(version_frame, textvariable=self.hw_version_var, font=("Consolas", 12), width=15)
        self.version_entry.pack(side=tk.LEFT, expand=True, fill=tk.X)
        self.save_button = tk.Button(version_frame, text="Save Version", font=("Comic Sans MS", 10), command=self.save_hw_version)
        self.save_button.pack(side=tk.LEFT, padx=(10, 0))

        self.status_label = tk.Label(main_frame, text="SELECT A MODE", font=("Comic Sans MS", 20, "bold"), bg=self.colors['status_idle'], fg="white", pady=10, relief=tk.RAISED, borderwidth=2)
        self.status_label.pack(fill=tk.X, pady=(10, 10))
        self.progress_bar = ttk.Progressbar(main_frame, orient='horizontal', length=100, mode='determinate')
        
        self.button_frame = tk.Frame(main_frame, bg=self.colors['bg'])
        self.button_frame.pack(fill=tk.X, pady=10)
        btn_font = ("Comic Sans MS", 16, "bold")
        self.prod_button = tk.Button(self.button_frame, text="PRODUCTION MODE", font=btn_font, bg=self.colors['prod_btn'], fg="white", command=self.select_mode_production, height=3, relief=tk.RAISED, borderwidth=4)
        self.test_button = tk.Button(self.button_frame, text="TESTING MODE", font=btn_font, bg=self.colors['test_btn'], fg="white", command=self.select_mode_testing, height=3, relief=tk.RAISED, borderwidth=4)
        self.stop_button = tk.Button(self.button_frame, text="STOP & CHANGE MODE", font=btn_font, bg=self.colors['stop_btn'], fg="white", command=self.stop_scanner, height=3, relief=tk.RAISED, borderwidth=4)
        
        self.show_mode_buttons()
        
        self.log_view = scrolledtext.ScrolledText(main_frame, font=("Consolas", 11), bg=self.colors['log_bg'], fg=self.colors['text'], relief=tk.SUNKEN, borderwidth=2, state=tk.DISABLED)
        self.log_view.pack(fill=tk.BOTH, expand=True, pady=(10, 0))

    def save_hw_version(self):
        new_version = self.hw_version_var.get()
        if parse_version(new_version):
            self.config_manager.save_hw_version(new_version)
            messagebox.showinfo("Success", f"Hardware version saved: {new_version}")
        else:
            messagebox.showerror("Error", "Invalid version format. Please use format X.Y.Z (e.g., 1.9.1)")

    def show_mode_buttons(self):
        self.stop_button.pack_forget()
        self.prod_button.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 10))
        self.test_button.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(10, 0))
        self.version_entry.config(state='normal')
        self.save_button.config(state='normal')


    def show_stop_button(self):
        self.prod_button.pack_forget()
        self.test_button.pack_forget()
        self.stop_button.pack(fill=tk.BOTH, expand=True)
        self.version_entry.config(state='disabled')
        self.save_button.config(state='disabled')

    def update_log(self):
        while not self.log_queue.empty():
            message = self.log_queue.get_nowait()
            if isinstance(message, tuple):
                if message[0] == 'progress':
                    self.progress_bar['value'] = message[1]
                elif message[0] == 'show_progress':
                    self.progress_bar.pack(fill=tk.X, pady=5)
                elif message[0] == 'hide_progress':
                    self.progress_bar.pack_forget()
            else:
                self.log_view.config(state=tk.NORMAL)
                self.log_view.insert(tk.END, message)
                self.log_view.see(tk.END)
                self.log_view.config(state=tk.DISABLED)
        self.root.after(100, self.update_log)

    def select_mode_production(self):
        if messagebox.askokcancel("Warning", "Production mode will NOT burn eFuses and requires devices to be tested first. Continue?"):
            self.start_scanner("production")

    def select_mode_testing(self):
        if messagebox.askokcancel("Notice", f"Testing mode will attempt to burn HW version {self.hw_version_var.get()} to eFuses. This is irreversible. Continue?"):
            self.start_scanner("testing")

    def start_scanner(self, mode):
        self.show_stop_button()
        if mode == 'production':
            self.status_label.config(text="ACTIVE MODE: PRODUCTION", bg=self.colors['status_prod'])
        else:
            self.status_label.config(text="ACTIVE MODE: TESTING", bg=self.colors['status_test'])
        self.scanner_stop_event.clear()
        self.log_queue.put(f"--- {mode.upper()} MODE ACTIVATED ---")
        scanner_thread = threading.Thread(target=self.scanner_worker, args=(mode,), daemon=True)
        scanner_thread.start()

    def stop_scanner(self):
        self.scanner_stop_event.set()
        self.log_queue.put("\n--- SCANNING STOPPED ---")
        self.log_queue.put("Please select a new mode.")
        self.status_label.config(text="SELECT A MODE", bg=self.colors['status_idle'])
        self.show_mode_buttons()

    def scanner_worker(self, mode):
        known_ports = {p.device for p in comports()}
        self.log_queue.put(f"Ignoring existing ports: {', '.join(known_ports) or 'None'}")
        self.log_queue.put("Waiting for new devices...")
        target_hw_version = self.hw_version_var.get() # Get version at the start of scanning
        self.log_queue.put(f"Using Target HW Version: {target_hw_version}")

        while not self.scanner_stop_event.is_set():
            try:
                current_ports = {p.device for p in comports()}
                new_ports = current_ports - known_ports
                if new_ports:
                    port_to_flash = new_ports.pop()
                    known_ports.add(port_to_flash)
                    process_thread = threading.Thread(target=process_device_thread, args=(self.log_queue, port_to_flash, mode, self.scanner_stop_event, target_hw_version), daemon=True)
                    process_thread.start()
                
                disconnected_ports = known_ports - current_ports
                if disconnected_ports:
                    known_ports.difference_update(disconnected_ports)
                    self.log_queue.put(f"Ports disconnected: {', '.join(disconnected_ports)}")
                
                time.sleep(2)
            except Exception as e:
                self.log_queue.put(f"[X] Error in scanner thread: {e}")
                time.sleep(5)

if __name__ == "__main__":
    root = tk.Tk()
    app = FlasherApp(root)
    root.mainloop()
