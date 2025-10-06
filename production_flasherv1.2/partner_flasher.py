import os
import sys
import time
import subprocess
import winsound
import threading
import queue
import tkinter as tk
from tkinter import scrolledtext, messagebox, ttk
from serial.tools.list_ports import comports
import re
import traceback
import serial
import tempfile
import psutil

# --- Configuration ---
TARGET_HW_VERSION = "1.9.0"
FIRMWARE_DIR_NAME = "testing_firmware"
FLASH_BAUD = "460800"
MONITOR_BAUD = 115200
LOCK_FILE_NAME = "dino_partner_flasher.lock"

# --- Sound Definitions ---
START_FREQ = 800
START_DUR = 150
END_FREQ = 1200
END_DUR = 400
ERROR_FREQ = 400
ERROR_DUR = 800

# --- Helper Functions ---
def play_sound(freq, duration):
    try:
        winsound.Beep(freq, duration)
    except Exception:
        pass

def resource_path(relative_path):
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

# --- Business Logic (Offline) ---
def parse_version(version_string):
    try:
        parts = version_string.split('.')
        if len(parts) != 3: return None
        return tuple(map(int, parts))
    except (ValueError, IndexError):
        return None

def burn_efuse(log_queue, port, version):
    log_queue.put(f"Attempting to burn eFuse with version {version}...")
    version_parts = parse_version(version)
    if not version_parts:
        log_queue.put(f"[X] Invalid version format: {version}")
        return False
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
            return False
        log_queue.put("[OK] eFuse burned successfully.")
        return True
    finally:
        if os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except OSError:
                pass

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

def flash_testing_firmware(log_queue, port, hardware_version):
    log_queue.put(('show_progress',))
    play_sound(START_FREQ, START_DUR)
    log_queue.put(f"-- Starting testing flash for HW {hardware_version} on {port} --")
    fw_dir = resource_path(FIRMWARE_DIR_NAME)
    bootloader, app, p_table, ota_data = [os.path.join(fw_dir, f) for f in ["bootloader.bin", "magical-toys.bin", "partition-table.bin", "ota_data_initial.bin"]]
    if any(not os.path.exists(f) for f in [bootloader, app, p_table, ota_data]):
        log_queue.put(f"[X] Firmware files not found in {fw_dir}. Ensure they are bundled correctly.")
        play_sound(ERROR_FREQ, ERROR_DUR)
        log_queue.put(('hide_progress',))
        return False
    flash_cmd = [sys.executable, "-m", "esptool", "--chip", "esp32s3", "-p", port, "-b", FLASH_BAUD, "--before=default_reset", "--after=hard_reset", "write_flash", "--flash_mode", "dio", "--flash_freq", "80m", "--flash_size", "16MB", "0x0", bootloader, "0x260000", app, "0x10000", p_table, "0x15000", ota_data]
    try:
        process = subprocess.Popen(flash_cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True, bufsize=1)
        for line in iter(process.stdout.readline, ''):
            log_queue.put(line)
            match = re.search(r"([\d\.]+)\%", line)
            if match:
                progress = int(float(match.group(1)))
                log_queue.put(('progress', progress))
        process.stdout.close()
        return_code = process.wait()
        if return_code != 0:
            log_queue.put(f"\n[X] Flash failed with exit code {return_code}.")
            play_sound(ERROR_FREQ, ERROR_DUR)
            return False
        else:
            log_queue.put("\n[OK] Flash successful!")
            play_sound(END_FREQ, END_DUR)
            return True
    except Exception as e:
        log_queue.put(f"\n[X] An unexpected error occurred during flash: {e}")
        play_sound(ERROR_FREQ, ERROR_DUR)
        return False
    finally:
        log_queue.put(('hide_progress',))
        log_queue.put(f"-- Finished flashing {port} --")

def serial_monitor_thread(log_queue, port, stop_event):
    try:
        ser = serial.Serial(port, MONITOR_BAUD, timeout=1)
        log_queue.put(f"--- Serial monitor started for {port} ---\n")
        while not stop_event.is_set():
            try:
                if ser.in_waiting > 0:
                    line = ser.readline()
                    log_queue.put(line.decode('utf-8', errors='replace'))
                else:
                    time.sleep(0.05)
                    if not any(p.device == port for p in comports()):
                        log_queue.put(f"\n--- Device {port} disconnected. Closing monitor. ---\n")
                        break
            except serial.SerialException:
                log_queue.put(f"\n--- Device {port} disconnected. Closing monitor. ---\n")
                break
        ser.close()
        log_queue.put(f"--- Serial monitor for {port} stopped. ---\n")
    except Exception as e:
        log_queue.put(f"\n[X] Error opening serial monitor on {port}: {e}\n")

def process_device_thread(log_queue, port, stop_event):
    try:
        log_queue.put(f"--- Processing new device on {port} ---")
        flash_hw_version = None
        burn_successful = burn_efuse(log_queue, port, TARGET_HW_VERSION)
        if burn_successful:
            log_queue.put("Burn command succeeded. Verifying by reading back eFuse...")
            time.sleep(1)
            read_version = read_efuse_version(log_queue, port)
            if read_version == TARGET_HW_VERSION:
                log_queue.put(f"[OK] Verification successful. Version {read_version} is burned.")
                flash_hw_version = TARGET_HW_VERSION
            else:
                log_queue.put(f"[X] VERIFICATION FAILED. Burned version ({read_version}) does not match target ({TARGET_HW_VERSION}). Stopping.")
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
        
        if flash_hw_version:
            flash_ok = flash_testing_firmware(log_queue, port, flash_hw_version)
            if flash_ok:
                monitor_thread = threading.Thread(target=serial_monitor_thread, args=(log_queue, port, stop_event), daemon=True)
                monitor_thread.start()

    except Exception as e:
        log_queue.put("!!!!!!!!!! UNEXPECTED ERROR in device processing thread !!!!!!!!!!")
        log_queue.put(f"ERROR: {e}")
        log_queue.put(traceback.format_exc())
        play_sound(ERROR_FREQ, ERROR_DUR)

class PartnerFlasherApp:
    def __init__(self, root):
        self.root = root
        self.root.title("DinoCore Partner Flasher")
        self.root.geometry("700x500")
        self.colors = {'bg': '#D4E1F5', 'log_bg': '#FFFFFF', 'text': '#333333', 'btn': '#4A90E2', 'stop_btn': '#D0021B'}
        self.root.configure(bg=self.colors['bg'])
        self.log_queue = queue.Queue()
        self.scanner_stop_event = threading.Event()
        self.is_scanning = False
        self.create_widgets()
        self.update_log()

    def create_widgets(self):
        main_frame = tk.Frame(self.root, bg=self.colors['bg'])
        main_frame.pack(padx=20, pady=20, fill=tk.BOTH, expand=True)
        
        title_label = tk.Label(main_frame, text="Partner Testing Flasher", font=("Arial", 24, "bold"), bg=self.colors['bg'], fg=self.colors['text'])
        title_label.pack(pady=(0, 20))

        self.progress_bar = ttk.Progressbar(main_frame, orient='horizontal', length=100, mode='determinate')
        
        self.start_button = tk.Button(main_frame, text="START SCANNING", font=("Arial", 18, "bold"), bg=self.colors['btn'], fg="white", command=self.start_scanner, height=3, relief=tk.RAISED, borderwidth=3)
        self.start_button.pack(fill=tk.X, pady=10)

        self.stop_button = tk.Button(main_frame, text="STOP SCANNING", font=("Arial", 18, "bold"), bg=self.colors['stop_btn'], fg="white", command=self.stop_scanner, height=3, relief=tk.RAISED, borderwidth=3)

        self.log_view = scrolledtext.ScrolledText(main_frame, font=("Consolas", 10), bg=self.colors['log_bg'], fg=self.colors['text'], relief=tk.SUNKEN, borderwidth=1, state=tk.DISABLED)
        self.log_view.pack(fill=tk.BOTH, expand=True, pady=(10, 0))

    def update_log(self):
        while not self.log_queue.empty():
            message = self.log_queue.get_nowait()
            if isinstance(message, tuple):
                if message[0] == 'progress':
                    self.progress_bar['value'] = message[1]
                elif message[0] == 'show_progress':
                    self.progress_bar.pack(fill=tk.X, pady=5, before=self.log_view)
                elif message[0] == 'hide_progress':
                    self.progress_bar.pack_forget()
            else:
                self.log_view.config(state=tk.NORMAL)
                self.log_view.insert(tk.END, message)
                self.log_view.see(tk.END)
                self.log_view.config(state=tk.DISABLED)
        self.root.after(100, self.update_log)

    def start_scanner(self):
        self.is_scanning = True
        self.start_button.pack_forget()
        self.stop_button.pack(fill=tk.X, pady=10)
        self.scanner_stop_event.clear()
        self.log_queue.put("--- SCANNING ACTIVATED ---")
        scanner_thread = threading.Thread(target=self.scanner_worker, daemon=True)
        scanner_thread.start()

    def stop_scanner(self):
        self.is_scanning = False
        self.scanner_stop_event.set()
        self.stop_button.pack_forget()
        self.start_button.pack(fill=tk.X, pady=10)
        self.log_queue.put("\n--- SCANNING STOPPED BY USER ---")

    def scanner_worker(self):
        known_ports = {p.device for p in comports()}
        self.log_queue.put(f"Ignoring existing ports: {', '.join(known_ports) or 'None'}")
        self.log_queue.put("Waiting for new devices...")
        while not self.scanner_stop_event.is_set():
            try:
                current_ports = {p.device for p in comports()}
                new_ports = current_ports - known_ports
                if new_ports:
                    port_to_flash = new_ports.pop()
                    known_ports.add(port_to_flash)
                    process_thread = threading.Thread(target=process_device_thread, args=(self.log_queue, port_to_flash, self.scanner_stop_event), daemon=True)
                    process_thread.start()
                disconnected_ports = known_ports - current_ports
                if disconnected_ports:
                    known_ports.difference_update(disconnected_ports)
                    self.log_queue.put(f"Ports disconnected: {', '.join(disconnected_ports)}")
                time.sleep(2)
            except Exception as e:
                self.log_queue.put(f"[X] Error in scanner thread: {e}")
                time.sleep(5)

# --- Single Instance Logic ---
def get_lock_file_path():
    # Use user's home directory for a stable lock file location
    return os.path.join(os.path.expanduser("~"), LOCK_FILE_NAME)

def is_already_running():
    lock_file = get_lock_file_path()
    if os.path.exists(lock_file):
        try:
            with open(lock_file, 'r') as f:
                pid = int(f.read())

            if psutil.pid_exists(pid):
                # PID exists, but is it our process? This avoids recycled PID issues.
                try:
                    p = psutil.Process(pid)
                    # The name of the exe is 'DinoPartnerFlasher'. When running from source, it's 'python'.
                    process_name = p.name().lower()
                    if "dinopartnerflasher" in process_name or "python" in process_name:
                        return True
                except psutil.NoSuchProcess:
                    # Process disappeared between checks, so it's not running.
                    pass
            
            # If we get here, the PID is stale or belongs to another process. Remove the lock file.
            os.remove(lock_file)

        except (IOError, ValueError, OSError):
            # If something goes wrong reading/removing, try to remove it one last time.
            try:
                os.remove(lock_file)
            except OSError:
                # If we still can't remove it, we have to exit.
                root = tk.Tk()
                root.withdraw()
                messagebox.showerror("Fatal Error", 
                                     f"Could not remove a stale lock file:\n{lock_file}\n\n" 
                                     "Please delete this file manually and restart.")
                sys.exit(1)
                
    return False

def create_lock_file():
    with open(get_lock_file_path(), 'w') as f:
        f.write(str(os.getpid()))

if __name__ == "__main__":
    # When frozen, subprocess calls to `sys.executable -m esptool` will re-run this script.
    # This block detects that scenario, runs the intended module, and exits, preventing a recursive loop.
    if getattr(sys, 'frozen', False) and '-m' in sys.argv:
        module_index = sys.argv.index('-m')
        module_to_run = sys.argv[module_index + 1]
        
        # Reconstruct argv for the target module
        sys.argv = [f'{module_to_run}.py'] + sys.argv[module_index + 2:]
        
        if module_to_run == 'espefuse':
            from espefuse import main as main_func
            main_func()
        elif module_to_run == 'esptool':
            from esptool import main as main_func
            main_func()
        sys.exit()

    if is_already_running():
        root = tk.Tk()
        root.withdraw()
        messagebox.showerror("Error", "DinoCore Partner Flasher is already running.")
        sys.exit(1)
    
    create_lock_file()
    
    root = tk.Tk()
    app = PartnerFlasherApp(root)

    def on_closing():
        if app.is_scanning:
            app.stop_scanner()
        try:
            os.remove(get_lock_file_path())
        except OSError:
            pass
        root.destroy()

    root.protocol("WM_DELETE_WINDOW", on_closing)
    root.mainloop()