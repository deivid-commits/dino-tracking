
import os
import sys
import subprocess
import threading
import queue
import tkinter as tk
from tkinter import scrolledtext, messagebox, ttk, simpledialog
from dino_console import DinoConsole

class RedirectText:
    def __init__(self, text_widget):
        self.text_widget = text_widget
        self.queue = queue.Queue()
        self.text_widget.after(100, self.process_queue)

    def write(self, string):
        self.queue.put(string)

    def process_queue(self):
        while not self.queue.empty():
            string = self.queue.get_nowait()
            self.text_widget.config(state=tk.NORMAL)
            self.text_widget.insert(tk.END, string)
            self.text_widget.see(tk.END)
            self.text_widget.config(state=tk.DISABLED)
        self.text_widget.after(100, self.process_queue)

    def flush(self):
        pass

class DinoTechnicianApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Dino Technician Console")
        self.root.geometry("900x700")
        
        self.dino_console = None
        self.hardware_version = ""

        self.create_widgets()
        self.ask_hardware_version()

    def create_widgets(self):
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)

        # --- Top Frame for Controls ---
        top_frame = ttk.Frame(main_frame)
        top_frame.pack(fill=tk.X, pady=(0, 10))

        # --- Device Management ---
        device_frame = ttk.LabelFrame(top_frame, text="Device Management", padding="10")
        device_frame.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 10))

        self.device_list = tk.Listbox(device_frame, height=5)
        self.device_list.pack(fill=tk.X, expand=True, pady=(0, 5))
        
        refresh_devices_btn = ttk.Button(device_frame, text="Refresh Devices", command=self.list_devices)
        refresh_devices_btn.pack(fill=tk.X)

        # --- Actions Frame ---
        actions_frame = ttk.LabelFrame(top_frame, text="Actions", padding="10")
        actions_frame.pack(side=tk.LEFT, fill=tk.X, expand=True)

        # --- Firmware Actions ---
        firmware_frame = ttk.Frame(actions_frame)
        firmware_frame.pack(fill=tk.X, pady=(0, 5))
        
        check_prod_btn = ttk.Button(firmware_frame, text="Check Production FW", command=self.check_production_firmware)
        check_prod_btn.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))
        
        check_test_btn = ttk.Button(firmware_frame, text="Check Testing FW", command=self.check_testing_firmware)
        check_test_btn.pack(side=tk.LEFT, fill=tk.X, expand=True)

        # --- Flashing Actions ---
        flash_frame = ttk.Frame(actions_frame)
        flash_frame.pack(fill=tk.X, pady=(0, 5))

        flash_prod_btn = ttk.Button(flash_frame, text="Flash Production", command=self.flash_production)
        flash_prod_btn.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))

        flash_test_btn = ttk.Button(flash_frame, text="Flash Testing", command=self.flash_testing)
        flash_test_btn.pack(side=tk.LEFT, fill=tk.X, expand=True)

        # --- eFuse Actions ---
        efuse_frame = ttk.Frame(actions_frame)
        efuse_frame.pack(fill=tk.X, pady=(0, 5))

        read_efuse_btn = ttk.Button(efuse_frame, text="Read eFuse", command=self.read_efuse)
        read_efuse_btn.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))

        burn_efuse_btn = ttk.Button(efuse_frame, text="Burn eFuse", command=self.burn_efuse)
        burn_efuse_btn.pack(side=tk.LEFT, fill=tk.X, expand=True)

        # --- Monitor Action ---
        monitor_btn = ttk.Button(actions_frame, text="Open Serial Monitor", command=self.open_monitor)
        monitor_btn.pack(fill=tk.X)

        # --- Log View ---
        log_frame = ttk.LabelFrame(main_frame, text="Log Output", padding="10")
        log_frame.pack(fill=tk.BOTH, expand=True)

        self.log_view = scrolledtext.ScrolledText(log_frame, font=("Consolas", 10), state=tk.DISABLED, wrap=tk.WORD)
        self.log_view.pack(fill=tk.BOTH, expand=True)

        # Redirect stdout
        sys.stdout = RedirectText(self.log_view)
        sys.stderr = RedirectText(self.log_view)

    def ask_hardware_version(self):
        self.hardware_version = simpledialog.askstring("Hardware Version", "Please enter the hardware version (e.g., 1.9.0):", parent=self.root)
        if not self.hardware_version:
            self.root.destroy()
            return
        
        try:
            self.dino_console = DinoConsole(hardware_version=self.hardware_version)
            self.root.title(f"Dino Technician Console - HW: {self.hardware_version}")
            print(f"Dino Technician Console initialized for HW version: {self.hardware_version}")
            self.list_devices()
        except Exception as e:
            messagebox.showerror("Initialization Error", f"Failed to initialize DinoConsole: {e}")
            self.root.destroy()

    def run_in_thread(self, target_func, *args):
        thread = threading.Thread(target=target_func, args=args, daemon=True)
        thread.start()

    def get_selected_device_index(self):
        selected = self.device_list.curselection()
        if not selected:
            messagebox.showwarning("No Device Selected", "Please select a device from the list.")
            return None
        return selected[0] + 1 # 1-based index for dino_console

    def list_devices(self):
        if not self.dino_console: return
        self.run_in_thread(self._list_devices_worker)

    def _list_devices_worker(self):
        print("--- Refreshing device list ---")
        self.dino_console.list_devices()
        self.root.after(0, self.update_device_list)
        print("--- Device list updated ---")

    def update_device_list(self):
        self.device_list.delete(0, tk.END)
        if self.dino_console and self.dino_console.devices_cache:
            for i, device in enumerate(self.dino_console.devices_cache):
                self.device_list.insert(tk.END, f"{i+1}. {device['port']} - {device['description']}")

    def check_production_firmware(self):
        if not self.dino_console: return
        self.run_in_thread(self.dino_console.check_firmware)

    def check_testing_firmware(self):
        if not self.dino_console: return
        self.run_in_thread(self.dino_console.check_testing_firmware)

    def flash_production(self):
        if not self.dino_console: return
        device_index = self.get_selected_device_index()
        if device_index is None: return

        if not messagebox.askokcancel("Confirm Flash", "WARNING: Production flashing is IRREVERSIBLE and will overwrite existing firmware. Continue?"):
            return
            
        self.run_in_thread(self.dino_console.parse_command, f"flash production {device_index}")

    def flash_testing(self):
        if not self.dino_console: return
        device_index = self.get_selected_device_index()
        if device_index is None: return
        
        self.run_in_thread(self.dino_console.parse_command, f"flash testing {device_index}")

    def read_efuse(self):
        if not self.dino_console: return
        device_index = self.get_selected_device_index()
        if device_index is None: return
        
        self.run_in_thread(self.dino_console.parse_command, f"read efuse {device_index}")

    def burn_efuse(self):
        if not self.dino_console: return
        device_index = self.get_selected_device_index()
        if device_index is None: return

        if not messagebox.askokcancel("Confirm Burn", "WARNING: Burning the eFuse is IRREVERSIBLE. This value cannot be changed. Continue?"):
            return
            
        self.run_in_thread(self.dino_console.parse_command, f"burn efuse {device_index}")

    def open_monitor(self):
        if not self.dino_console: return
        device_index = self.get_selected_device_index()
        if device_index is None: return
        
        port = self.dino_console.resolve_device(str(device_index))
        if not port:
            return

        # The monitor blocks, so it needs a dedicated window or different handling.
        # For now, we will run it in a thread and output to the main log.
        # A better implementation would open a new window for the monitor.
        messagebox.showinfo("Serial Monitor", "Serial monitor output will appear in the main log window. The application might be less responsive. Close the app to stop the monitor.")
        self.run_in_thread(self.dino_console.open_monitor, port)


if __name__ == "__main__":
    root = tk.Tk()
    app = DinoTechnicianApp(root)
    
    def on_closing():
        if messagebox.askokcancel("Quit", "Do you want to exit?"):
            # Cleanly close stdout redirection
            sys.stdout = sys.__stdout__
            sys.stderr = sys.__stderr__
            root.destroy()

    root.protocol("WM_DELETE_WINDOW", on_closing)
    root.mainloop()
