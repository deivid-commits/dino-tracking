#!/bin/bash
# Auto-Updater Launcher for DinoCore Production Flasher (Linux/macOS)
# This script automatically checks for updates and applies them before launching the GUI

# Get script directory (cross-platform)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Change to script directory
cd "$SCRIPT_DIR"

# Check if Python is available
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "❌ Python not found. Please install Python 3.7 or higher."
    echo "   On Ubuntu/Debian: sudo apt install python3"
    echo "   On macOS: brew install python3"
    exit 1
fi

# Use python3 if available, otherwise python
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
else
    PYTHON_CMD="python"
fi

# Run the auto-updater launcher
echo "🦕 DinoCore Production Flasher"
echo "🔄 Checking for updates..."
"$PYTHON_CMD" auto_updater_launcher.py
