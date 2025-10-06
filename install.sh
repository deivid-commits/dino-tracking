#!/bin/bash

# DinoCore Production Flasher - Unix/Linux Installation Script
# This script sets up the Python environment and installs dependencies

echo "==============================================="
echo "🦕 DinoCore Production Flasher Installer"
echo "==============================================="
echo

# Function to check command existence
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

echo "📦 Checking Python installation..."
if command_exists python3; then
    PYTHON_CMD="python3"
    PIP_CMD="pip3"
    echo "✅ Python 3 found"
elif command_exists python; then
    PYTHON_CMD="python"
    PIP_CMD="pip"
    # Check if python is Python 3
    if $PYTHON_CMD --version 2>&1 | grep -q "Python 3"; then
        echo "✅ Python 3 found"
    else
        echo "⚠️  Python 2 detected, trying to find Python 3..."
        if command_exists python3; then
            PYTHON_CMD="python3"
            PIP_CMD="pip3"
            echo "✅ Python 3 found"
        else
            echo "❌ Python 3 is required but not found"
            echo "Please install Python 3.7+ first"
            echo "On Ubuntu/Debian: sudo apt install python3 python3-pip python3-tk"
            echo "On macOS with Homebrew: brew install python3"
            echo "On CentOS/RHEL: sudo yum install python3 python3-pip python3-tkinter"
            exit 1
        fi
    fi
else
    echo "❌ Python is not installed"
    echo "Please install Python 3.7+ first"
    echo "On Ubuntu/Debian: sudo apt install python3 python3-pip python3-tk"
    echo "On macOS with Homebrew: brew install python3"
    echo "On CentOS/RHEL: sudo yum install python3 python3-pip python3-tkinter"
    exit 1
fi

echo
echo "🔄 Checking pip installation..."
if command_exists $PIP_CMD; then
    echo "✅ pip found"
else
    echo "❌ pip not found, installing..."
    if command_exists easy_install; then
        sudo easy_install pip
    else
        echo "❌ Could not install pip automatically"
        echo "Please install pip manually"
        exit 1
    fi
fi

echo
echo "📦 Installing/updating Python dependencies..."
echo "This may take a few minutes..."

# Try to install dependencies
if $PIP_CMD install -r production_flasherv1.2/requirements.txt; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    echo "Trying with sudo..."
    if sudo $PIP_CMD install -r production_flasherv1.2/requirements.txt; then
        echo "✅ Dependencies installed successfully with sudo"
    else
        echo "❌ Failed to install dependencies even with sudo"
        echo "You may need to install missing system packages:"
        echo "  Ubuntu/Debian: sudo apt install python3-tk python3-dev build-essential libffi-dev"
        echo "  CentOS/RHEL: sudo yum install python3-tkinter python3-devel gcc libffi-devel"
        echo "  macOS: xcode-select --install"
        exit 1
    fi
fi

echo
echo "🔍 Checking for common system dependencies..."

# Check for tkinter (python3-tk)
echo "📦 Checking tkinter (GUI support)..."
$PYTHON_CMD -c "import tkinter; print('✅ tkinter available')" 2>/dev/null || {
    echo "⚠️  tkinter not available - GUI applications won't work"
    echo "Install with:"
    echo "  Ubuntu/Debian: sudo apt install python3-tk"
    echo "  CentOS/RHEL: sudo yum install python3-tkinter"
    echo "  macOS: Should be included with Python 3"
    echo "Continuing anyway..."
}

echo
echo "🚀 Installation complete!"
echo
echo "You can now use DinoCore Production Flasher by running:"
echo
echo "  cd production_flasherv1.2"
echo "  $PYTHON_CMD dino_console.py 1.9.0"
echo
echo "For GUI mode:"
echo "  $PYTHON_CMD gui_flasher.py"
echo
echo "For direct update commands:"
echo "  cd production_flasherv1.2"
echo "  $PYTHON_CMD updater.py check"
echo "  $PYTHON_CMD updater.py update"
echo
echo "Happy flashing! 🔧⚡"
