#!/usr/bin/env python3
"""
DinoCore Production Flasher Auto-Updater Launcher
Automatically checks and applies updates before launching the GUI
"""

import os
import sys
import subprocess

def main():
    """Main auto-updater launcher function"""
    print("🦕 DinoCore Production Flasher")
    print("🔄 Checking for updates...")

    try:
        # Check for updates
        result = subprocess.run([
            sys.executable, 'updater.py', 'check'
        ], capture_output=True, text=True, cwd=os.path.dirname(__file__))

        if result.returncode == 0:
            # No updates available, continue to launch app
            print("✅ You are up to date!")
            print("🚀 Starting application...")
        else:
            # Updates found - apply them automatically
            print("📦 Updates found! Installing automatically...")
            print("This may take a moment...")

            update_result = subprocess.run([
                sys.executable, 'updater.py', 'update', '--yes'
            ], cwd=os.path.dirname(__file__))

            if update_result.returncode != 0:
                print("⚠️  Update failed, but continuing to launch application...")
                print("   You can manually update later with: python updater.py update")
            else:
                print("✅ Updates installed successfully!")

            print("🚀 Starting application...")

    except Exception as e:
        print(f"⚠️  Could not check for updates: {e}")
        print("🚀 Starting application (update check skipped)...")

    # Launch the main application
    try:
        subprocess.run([
            sys.executable, 'gui_flasher.py'
        ], cwd=os.path.dirname(__file__))
    except Exception as e:
        print(f"❌ Error launching application: {e}")
        print("You can try launching manually with: python gui_flasher.py")
        input("Press Enter to exit...")

if __name__ == "__main__":
    main()
