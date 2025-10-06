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

# Import internationalization system
from i18n_utils import _, translation_manager

# Import local modules
try:
    from updater import DinoUpdater
except ImportError:
    DinoUpdater = None

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
            log_queue.put(_("Attempting to burn eFuse with version {version}...").format(version=target_hw_version))
            burn_successful = burn_efuse(log_queue, port, target_hw_version)
            if burn_successful:
                log_queue.put(_("Burn command succeeded. Verifying by reading back eFuse..."))
                time.sleep(2)  # Increased delay for device stabilization
                read_version = read_efuse_version(log_queue, port)
                if read_version == target_hw_version:
                    log_queue.put(_("[OK] Verification successful. Version {version} is burned.").format(version=read_version))
                    flash_hw_version = target_hw_version
                    log_queue.put(_("eFuse burning completed successfully. Starting firmware flash..."))
                else:
                    log_queue.put(_("[X] VERIFICATION FAILED. Burned version ({burned}) does not match target ({target}). Stopping.").format(burned=read_version, target=target_hw_version))
                    play_sound(ERROR_FREQ, ERROR_DUR)
                    return
            else:
                log_queue.put(_("Burn command failed. Attempting to read existing version..."))
                existing_version = read_efuse_version(log_queue, port)
                if existing_version:
                    log_queue.put(_("Proceeding with existing version: {version}").format(version=existing_version))
                    flash_hw_version = existing_version
                else:
                    log_queue.put(_("[X] Could not read existing version after burn failure. Stopping."))
                    play_sound(ERROR_FREQ, ERROR_DUR)
                    return
        elif mode == 'production':
            log_queue.put(_("Production mode: Reading eFuse..."))
            existing_version = read_efuse_version(log_queue, port)
            if existing_version:
                flash_hw_version = existing_version
                log_queue.put(_("Found eFuse version: {version}. Starting firmware flash...").format(version=existing_version))
            else:
                log_queue.put(_("[X] PRODUCTION FAILED: No eFuse version found. Please run device through Testing Mode first."))
                play_sound(ERROR_FREQ, ERROR_DUR)
                return

        # If we have a firmware version to flash, proceed with flashing
        if flash_hw_version:
            log_queue.put(_("-- Starting {mode} flash for HW {hardware_version} on {port} --").format(
                mode=mode.capitalize(), hardware_version=flash_hw_version, port=port))
            flash_ok = flash_device(log_queue, port, mode, flash_hw_version)
            if flash_ok:
                log_queue.put(_("Flash completed successfully. Starting serial monitor..."))
                serial_monitor_thread(log_queue, port, stop_event)
            else:
                log_queue.put(_("[X] Flash failed. Unable to complete device programming."))
                play_sound(ERROR_FREQ, ERROR_DUR)
        else:
            log_queue.put(_("[X] No valid hardware version found. Cannot proceed with flash."))
            play_sound(ERROR_FREQ, ERROR_DUR)

    except Exception as e:
        log_queue.put("!!!!!!!!!! UNEXPECTED ERROR in device processing thread !!!!!!!!!!!")
        log_queue.put(f"ERROR: {e}")
        log_queue.put(traceback.format_exc() + "\n")
        play_sound(ERROR_FREQ, ERROR_DUR)

class FlasherApp:
    def __init__(self, root):
        self.root = root
        self.root.title(_("🦕 DinoCore Production Flasher v1.2.0"))
        self.root.geometry("800x700")
        self.root.resizable(True, True)

        # Ultra-Modern Dark Theme
        self.colors = {
            'bg': '#1e1e2e',           # Deep dark blue-grey
            'log_bg': '#2a2a3a',       # Slightly lighter dark
            'text': '#cdd6f4',         # Light blue-grey text
            'log_text': '#89b4fa',     # Light blue
            'header_bg': '#181825',    # Very dark header
            'prod_btn': '#f38ba8',     # Soft red
            'test_btn': '#89dceb',     # Soft blue
            'stop_btn': '#a6e3a1',     # Soft green
            'success_btn': '#a6e3a1',  # Emerald
            'warning_btn': '#f9e2af',  # Yellow
            'status_prod': '#f38ba8',  # Red for active
            'status_test': '#89dceb',  # Blue for active
            'status_idle': '#6c7086',  # Grey for idle
            'status_success': '#a6e3a1', # Green for success
            'status_warning': '#fab387',  # Orange warning
            'frame_bg': '#313244',     # Medium grey-blue
            'entry_bg': '#1e1e2e',     # Same as bg
            'entry_fg': '#cdd6f4',     # Light text
            'border': '#f38ba8',       # Red accent
            'highlight': '#89b4fa'     # Blue accent
        }

        self.root.configure(bg=self.colors['bg'])
        self.root.attributes('-topmost', True)  # Always on top for better UX
        self.root.after(100, lambda: self.root.attributes('-topmost', False))
        
        self.config_manager = ConfigManager(CONFIG_FILE)
        self.hw_version_var = tk.StringVar(value=self.config_manager.get_hw_version())
        
        self.log_queue = queue.Queue()
        self.scanner_stop_event = threading.Event()
        self.create_widgets()
        self.update_log()

    def create_widgets(self):
        # Modern header with gradient and branding
        header_frame = tk.Frame(self.root, bg=self.colors['header_bg'], height=60)
        header_frame.pack(fill=tk.X, padx=0, pady=0)
        header_frame.pack_propagate(False)

        # Header content
        header_content = tk.Frame(header_frame, bg=self.colors['header_bg'])
        header_content.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)

        # Logo and title
        title_frame = tk.Frame(header_content, bg=self.colors['header_bg'])
        title_frame.pack(side=tk.LEFT)

        tk.Label(title_frame, text="🦕", font=("Segoe UI Emoji", 24), bg=self.colors['header_bg'], fg="#f38ba8").pack(side=tk.LEFT, padx=(0, 10))
        self.title_label = tk.Label(title_frame, text=_("DinoCore Production Flasher"),
                                   font=("Segoe UI", 18, "bold"), bg=self.colors['header_bg'],
                                   fg=self.colors['text'])
        self.title_label.pack(side=tk.LEFT)

        tk.Label(title_frame, text="v1.2.0", font=("Segoe UI", 10), bg=self.colors['header_bg'],
                fg=self.colors['log_text']).pack(side=tk.LEFT, padx=(10, 0))

        # Language cycle button
        lang_names = {'en': 'EN', 'zh_CN': '简中', 'zh_TW': '繁中'}
        current_lang = translation_manager.get_current_language()
        self.language_button = tk.Button(header_content,
                                        text=f"🌐 {lang_names.get(current_lang, 'EN')}",
                                        font=("Segoe UI", 9, "bold"),
                                        bg=self.colors['header_bg'], fg=self.colors['text'],
                                        relief=tk.FLAT, borderwidth=0,
                                        command=self.cycle_language)
        self.language_button.pack(side=tk.RIGHT, padx=(10, 0))

        # Connection status indicator
        self.connection_label = tk.Label(header_content, text=_("🔗 SERVER ONLINE"),
                                        font=("Segoe UI", 10), bg=self.colors['success_btn'],
                                        fg=self.colors['bg'], padx=10, pady=2, relief=tk.RAISED)
        self.connection_label.pack(side=tk.RIGHT)

        # Main content area
        content_frame = tk.Frame(self.root, bg=self.colors['bg'])
        content_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)

        # Configuration section
        config_frame = tk.LabelFrame(content_frame, text=f" ⚙️ {_('Configuration')} ", font=("Segoe UI", 11, "bold"),
                                    bg=self.colors['frame_bg'], fg=self.colors['text'],
                                    relief=tk.GROOVE, borderwidth=2)
        config_frame.pack(fill=tk.X, pady=(0, 15))

        config_inner = tk.Frame(config_frame, bg=self.colors['frame_bg'])
        config_inner.pack(fill=tk.X, padx=15, pady=10)

        tk.Label(config_inner, text=_("🎯 Target HW Version:"), font=("Segoe UI", 12, "bold"),
                bg=self.colors['frame_bg'], fg=self.colors['text']).pack(side=tk.LEFT)
        self.version_entry = tk.Entry(config_inner, textvariable=self.hw_version_var,
                                     font=("Consolas", 12), width=15, bg=self.colors['entry_bg'],
                                     fg=self.colors['entry_fg'], insertbackground=self.colors['text'],
                                     relief=tk.FLAT, borderwidth=1)
        self.version_entry.pack(side=tk.LEFT, padx=(15, 10))
        self.save_button = tk.Button(config_inner, text=_("💾 Save Version"), font=("Segoe UI", 10, "bold"),
                                    bg=self.colors['success_btn'], fg=self.colors['bg'],
                                    command=self.save_hw_version, relief=tk.FLAT, padx=15)
        self.save_button.pack(side=tk.LEFT, padx=(0, 10))

        # Update button (only if updater is available)
        if DinoUpdater is not None:
            self.update_button = tk.Button(config_inner, text=_("🔄 Check Updates"), font=("Segoe UI", 10, "bold"),
                                          bg=self.colors['warning_btn'], fg=self.colors['bg'],
                                          command=self.check_for_updates, relief=tk.FLAT, padx=15)
            self.update_button.pack(side=tk.LEFT)
        else:
            tk.Label(config_inner, text=_("🔄 Auto-update system not available"), font=("Segoe UI", 9),
                    bg=self.colors['frame_bg'], fg=self.colors['log_text']).pack(side=tk.LEFT, padx=(10, 0))

        # Status and control section
        status_frame = tk.LabelFrame(content_frame, text=f" 🎮 {_('Control Panel')} ", font=("Segoe UI", 11, "bold"),
                                    bg=self.colors['frame_bg'], fg=self.colors['text'],
                                    relief=tk.GROOVE, borderwidth=2)
        status_frame.pack(fill=tk.X, pady=(0, 15))
        self.status_frame = status_frame  # Store reference for progress bar

        status_inner = tk.Frame(status_frame, bg=self.colors['frame_bg'])
        status_inner.pack(fill=tk.X, padx=15, pady=10)

        # Status display
        self.status_label = tk.Label(status_inner, text=_("▶️  SELECT A MODE"), font=("Segoe UI", 16, "bold"),
                                    bg=self.colors['status_idle'], fg="white", pady=8, padx=15,
                                    relief=tk.FLAT)
        self.status_label.pack(fill=tk.X, pady=(0, 10))

        # Progress bar (hidden initially)
        progress_frame = tk.Frame(status_inner, bg=self.colors['frame_bg'])
        # Initialize progress bar but don't show yet
        self.progress_bar = ttk.Progressbar(status_frame, orient='horizontal', length=100, mode='determinate',
                                           style="TProgressbar")
        self.progress_visible = False

        # Action buttons
        self.button_frame = tk.Frame(status_inner, bg=self.colors['frame_bg'])
        self.button_frame.pack(fill=tk.X, pady=(10, 0))

        button_config = {
            'font': ("Segoe UI", 14, "bold"),
            'relief': tk.FLAT,
            'borderwidth': 0,
            'pady': 15
        }

        self.prod_button = tk.Button(self.button_frame, text=_("🏭 PRODUCTION MODE"),
                                    bg=self.colors['prod_btn'], fg=self.colors['bg'],
                                    command=self.select_mode_production, **button_config)
        self.test_button = tk.Button(self.button_frame, text=_("🧪 TESTING MODE"),
                                    bg=self.colors['test_btn'], fg=self.colors['bg'],
                                    command=self.select_mode_testing, **button_config)
        self.stop_button = tk.Button(self.button_frame, text=_("⏹️  STOP & CHANGE MODE"),
                                    bg=self.colors['stop_btn'], fg=self.colors['bg'],
                                    command=self.stop_scanner, **button_config)

        self.show_mode_buttons()

        # Enhanced log section
        log_frame = tk.LabelFrame(content_frame, text=f" 📋 {_('Activity Log')} ", font=("Segoe UI", 11, "bold"),
                                 bg=self.colors['frame_bg'], fg=self.colors['text'],
                                 relief=tk.GROOVE, borderwidth=2)
        log_frame.pack(fill=tk.BOTH, expand=True)

        log_inner = tk.Frame(log_frame, bg=self.colors['frame_bg'])
        log_inner.pack(fill=tk.BOTH, expand=True, padx=15, pady=10)

        # Enhanced log with syntax highlighting colors
        self.log_view = scrolledtext.ScrolledText(
            log_inner, font=("Fira Code", 10) if self.is_font_available("Fira Code") else ("Consolas", 10),
            bg=self.colors['log_bg'], fg=self.colors['log_text'],
            insertbackground=self.colors['highlight'], selectbackground=self.colors['highlight'],
            relief=tk.FLAT, borderwidth=0, padx=10, pady=5, wrap=tk.WORD, state=tk.DISABLED
        )
        self.log_view.pack(fill=tk.BOTH, expand=True)

        # Configure color-coded text tags
        self.log_view.tag_config("success", foreground=self.colors['success_btn'])
        self.log_view.tag_config("error", foreground=self.colors['prod_btn'])
        self.log_view.tag_config("warning", foreground=self.colors['warning_btn'])

        # Start connection monitoring
        self.update_connection_status()

    def is_font_available(self, font_name):
        """Check if a font is available on the system"""
        try:
            test_label = tk.Label(self.root, font=(font_name, 10))
            return True
        except:
            return False

    def update_connection_status(self):
        """Monitor and update connection status"""
        try:
            # Check if we can reach the DinoCore API
            response = requests.get("https://dinocore-telemetry-production.up.railway.app/api/status",
                                  timeout=5)
            if response.status_code == 200:
                self.connection_label.config(text="🔗 SERVER ONLINE", bg=self.colors['success_btn'])
            else:
                self.connection_label.config(text="⚠️ SERVER ISSUES", bg=self.colors['warning_btn'])
        except:
            self.connection_label.config(text="❌ OFFLINE", bg=self.colors['prod_btn'])

        # Update every 30 seconds
        self.root.after(30000, self.update_connection_status)

    def save_hw_version(self):
        new_version = self.hw_version_var.get()
        if parse_version(new_version):
            self.config_manager.save_hw_version(new_version)
            messagebox.showinfo(_("Success"), _("Hardware version saved: {version}").format(version=new_version))
        else:
            messagebox.showerror(_("Error"), _("Invalid version format. Please use format X.Y.Z (e.g., 1.9.1)"))

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
                    if not self.progress_visible:
                        self.progress_bar.pack(in_=self.status_frame, fill=tk.X, pady=5, before=self.button_frame)
                        self.progress_visible = True
                elif message[0] == 'hide_progress':
                    if self.progress_visible:
                        self.progress_bar.pack_forget()
                        self.progress_visible = False
            else:
                self.log_view.config(state=tk.NORMAL)
                # Color-code different types of log messages
                if "[OK]" in message or "✅" in message or "[SUCCESS]" in message:
                    self.log_view.insert(tk.END, message[:-1], "success")  # Remove newline for tag
                    self.log_view.insert(tk.END, "\n")  # Add newline after tag
                elif "[X]" in message or "❌" in message or "[ERROR]" in message or "[FAILED]" in message:
                    self.log_view.insert(tk.END, message[:-1], "error")  # Remove newline for tag
                    self.log_view.insert(tk.END, "\n")  # Add newline after tag
                elif "[!]" in message or "⚠️" in message or "[WARNING]" in message:
                    self.log_view.insert(tk.END, message[:-1], "warning")  # Remove newline for tag
                    self.log_view.insert(tk.END, "\n")  # Add newline after tag
                else:
                    self.log_view.insert(tk.END, message)

                self.log_view.see(tk.END)
                self.log_view.config(state=tk.DISABLED)

        self.root.after(100, self.update_log)

    def select_mode_production(self):
        if messagebox.askokcancel(_("Warning"), _("Production mode will NOT burn eFuses and requires devices to be tested first. Continue?")):
            self.start_scanner("production")

    def select_mode_testing(self):
        if messagebox.askokcancel(_("Notice"), _("Testing mode will attempt to burn HW version {version} to eFuses. This is irreversible. Continue?").format(version=self.hw_version_var.get())):
            self.start_scanner("testing")

    def start_scanner(self, mode):
        self.show_stop_button()
        if mode == 'production':
            self.status_label.config(text=_("ACTIVE MODE: PRODUCTION"), bg=self.colors['status_prod'])
        else:
            self.status_label.config(text=_("ACTIVE MODE: TESTING"), bg=self.colors['status_test'])
        self.scanner_stop_event.clear()
        self.log_queue.put(f"--- {mode.upper()} MODE ACTIVATED ---")
        scanner_thread = threading.Thread(target=self.scanner_worker, args=(mode,), daemon=True)
        scanner_thread.start()

    def stop_scanner(self):
        self.scanner_stop_event.set()
        self.log_queue.put(f"\n--- {_('SCANNING STOPPED')} ---")
        self.log_queue.put(_("Please select a new mode."))
        self.status_label.config(text=_("▶️  SELECT A MODE"), bg=self.colors['status_idle'])
        self.show_mode_buttons()

    def scanner_worker(self, mode):
        known_ports = {p.device for p in comports()}
        self.log_queue.put(f"{_('Ignoring existing ports:')} {', '.join(known_ports) or 'None'}")
        self.log_queue.put(_("Waiting for new devices..."))
        target_hw_version = self.hw_version_var.get() # Get version at the start of scanning
        self.log_queue.put(f"{_('Using Target HW Version:')} {target_hw_version}")

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
                    self.log_queue.put(f"{_('Ports disconnected:')} {', '.join(disconnected_ports)}")

                time.sleep(2)
            except Exception as e:
                self.log_queue.put(f"[X] {_('Error in scanner thread:')} {e}")
                time.sleep(5)

    def cycle_language(self):
        """Cycle through available languages: EN -> ZH_CN -> ZH_TW -> EN"""
        current_lang = translation_manager.get_current_language()
        languages = ['en', 'zh_CN', 'zh_TW']

        try:
            current_index = languages.index(current_lang)
            next_index = (current_index + 1) % len(languages)
        except ValueError:
            next_index = 1  # Default to zh_CN if current not found

        next_lang = languages[next_index]

        if translation_manager.set_language(next_lang):
            # Update button text
            lang_names = {'en': 'EN', 'zh_CN': '简中', 'zh_TW': '繁中'}
            self.language_button.config(text=f"🌐 {lang_names.get(next_lang, 'EN')}")

            # Refresh all UI texts to new language
            self.update_all_texts()
        else:
            messagebox.showerror(_("Error"), _("Failed to change language"))

    def check_for_updates(self):
        """Check for updates and show results in log"""
        if DinoUpdater is None:
            messagebox.showerror(_("Error"), _("Update system is not available"))
            return

        # Disable the update button during check
        self.update_button.config(state='disabled', text=_("🔄 Checking..."))

        def update_check_thread():
            try:
                updater = DinoUpdater()
                update_info = updater.check_for_updates()

                if update_info:
                    # Show update available dialog
                    changelog = update_info['changelog'][:300] + "..." if len(update_info['changelog']) > 300 else update_info['changelog']
                    message = _(f"Update available: {update_info['version']}\n\nChanges:\n{changelog}\n\nDo you want to install this update?")

                    # Use after() to show dialog in main thread
                    def show_update_dialog():
                        if messagebox.askyesno(_("Update Available"), message):
                            self.perform_update(update_info)
                        else:
                            self.log_queue.put(_("Update cancelled by user"))
                            self.update_button.config(state='normal', text=_("🔄 Check Updates"))

                    self.root.after(0, show_update_dialog)
                else:
                    self.log_queue.put(_("✅ You are using the latest version"))
                    self.root.after(0, lambda: self.update_button.config(state='normal', text=_("🔄 Check Updates")))

            except Exception as e:
                self.log_queue.put(_(f"[X] Update check failed: {e}"))
                self.root.after(0, lambda: self.update_button.config(state='normal', text=_("🔄 Check Updates")))

        # Start update check in background thread
        thread = threading.Thread(target=update_check_thread, daemon=True)
        thread.start()

    def perform_update(self, update_info):
        """Perform the actual update"""
        # Disable button and show progress
        self.update_button.config(state='disabled', text=_("⬆️ Updating..."))

        def update_thread():
            try:
                updater = DinoUpdater()
                if updater.update(auto_confirm=True):
                    self.log_queue.put(_("✅ Update completed! Please restart the application."))
                    messagebox.showinfo(_("Success"), _("Update completed successfully!\n\nPlease restart the application to use the new version."))
                else:
                    self.log_queue.put(_("[X] Update failed or was cancelled"))
                    messagebox.showerror(_("Error"), _("Update failed. Check the log for details."))
            except Exception as e:
                self.log_queue.put(_(f"[X] Update error: {e}"))
                messagebox.showerror(_("Error"), _("Update failed. Check the log for details."))

            # Re-enable button
            self.root.after(0, lambda: self.update_button.config(state='normal', text=_("🔄 Check Updates")))

        # Start update in background thread
        thread = threading.Thread(target=update_thread, daemon=True)
        thread.start()

    def update_all_texts(self):
        """Update all interface texts after language change"""
        # Update window title
        self.root.title(_(WINDOW_TITLE))

        # Update title label
        self.title_label.config(text=_("DinoCore Production Flasher"))

        # Refresh interface - will be handled by the translation system
        # Since we use _() calls, they will automatically get new translations
        # The next time the interface is redrawn, it will show the new language



if __name__ == "__main__":
    root = tk.Tk()
    app = FlasherApp(root)
    root.mainloop()
