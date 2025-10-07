#!/bin/bash
# DinoCore Production Flasher - Install Dependencies
# This script installs all required dependencies for the DinoCore Production Flasher

echo ""
echo "🦕 ========================================"
echo "🦕  DinoCore Production Flasher Setup"
echo "🦕 ========================================"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed!"
    echo "   Please install Python 3.7 or higher"
    echo ""
    exit 1
fi

echo "✅ Python found: $(python3 --version)"
echo ""

# Check if pip is available
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 is not available!"
    echo "   Please install pip3 first."
    echo ""
    exit 1
fi

echo "✅ pip found: $(pip3 --version)"
echo ""

# Upgrade pip first
echo "🔄 Upgrading pip..."
python3 -m pip install --upgrade pip
if [ $? -ne 0 ]; then
    echo "❌ Failed to upgrade pip"
    echo ""
    exit 1
fi

echo "✅ pip upgraded successfully"
echo ""

# Install required packages
echo "🔄 Installing required packages..."
echo "   This may take a few minutes..."
echo ""

# Core dependencies
echo "   Installing esptool..."
python3 -m pip install esptool>=4.0.0

echo "   Installing pyserial..."
python3 -m pip install pyserial>=3.5

echo "   Installing requests..."
python3 -m pip install requests>=2.25.0

# Bluetooth LE support (optional but recommended)
echo "   Installing bleak for Bluetooth QC..."
python3 -m pip install bleak>=0.19.0

# Firebase support (optional but recommended for data logging)
echo "   Installing firebase-admin for database integration..."
python3 -m pip install firebase-admin>=6.0.0

echo ""
echo "✅ All dependencies installed successfully!"
echo ""

# Verify installations
echo "🔍 Verifying installations..."
echo ""

if python3 -c "import esptool; print('✅ esptool OK')" 2>/dev/null; then
    echo "✅ esptool installed correctly"
else
    echo "❌ esptool installation failed"
fi

if python3 -c "import serial; print('✅ pyserial OK')" 2>/dev/null; then
    echo "✅ pyserial installed correctly"
else
    echo "❌ pyserial installation failed"
fi

if python3 -c "import requests; print('✅ requests OK')" 2>/dev/null; then
    echo "✅ requests installed correctly"
else
    echo "❌ requests installation failed"
fi

if python3 -c "import bleak; print('✅ bleak OK')" 2>/dev/null; then
    echo "✅ bleak installed correctly - Bluetooth QC enabled"
else
    echo "⚠️ bleak installation failed - Bluetooth QC will be disabled"
    echo "   To enable Bluetooth QC, install manually: pip3 install bleak"
fi

echo ""
echo "🎉 Setup completed!"
echo ""
echo "You can now run the DinoCore Production Flasher:"
echo "   - Run: python3 gui_flasher.py"
echo "   - Or: ./start_gui.sh"
echo ""
echo "If you encounter any issues, make sure:"
echo "   - Python 3.7+ is installed"
echo "   - All dependencies are installed"
echo "   - Bluetooth drivers are up to date (for QC features)"
echo ""

# Make script executable
chmod +x "$0"
