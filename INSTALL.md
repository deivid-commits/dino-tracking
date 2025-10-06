# 🦕 DinoCore Production Flasher - Installation Guide

Welcome to the DinoCore Production Flasher installation guide! This comprehensive tool suite helps you flash and manage ESP32-S3 devices for the DinoCore project.

## 🎯 Quick Start

### Windows Users
```batch
# Download the repository
git clone https://github.com/your-github-username/dino-production-flasher.git
cd dino-production-flasher

# Run the installer
install.bat
```

### Linux/macOS Users
```bash
# Download the repository
git clone https://github.com/your-github-username/dino-production-flasher.git
cd dino-production-flasher

# Make installer executable and run
chmod +x install.sh
./install.sh
```

## 📋 System Requirements

### Minimum Requirements
- **Python**: 3.7 or higher
- **RAM**: 512 MB
- **Storage**: 100 MB free space
- **OS**: Windows 10+, macOS 10.12+, Ubuntu 16.04+

### Operating System Support
- ✅ **Windows**: All versions (7, 8, 10, 11)
- ✅ **macOS**: 10.12 Sierra and later
- ✅ **Linux**: Ubuntu, Debian, CentOS, Fedora, and derivatives

### Hardware Requirements
- ESP32-S3 devices for flashing
- USB-to-Serial adapter (FTDI, CH340, CP2102, etc.)
- USB cable for device connection

## 🚀 Installation Methods

### Method 1: Automated Installation (Recommended)

We've created automated installation scripts for each platform:

#### Windows (`install.bat`)
```batch
# Double-click install.bat or run from command prompt
install.bat
```

What it does:
1. ✅ Verifies Python installation
2. ✅ Checks pip availability
3. ✅ Installs Python dependencies automatically
4. ✅ Provides usage instructions

#### Unix/Linux/macOS (`install.sh`)
```bash
# Make executable (first time only)
chmod +x install.sh

# Run the installer
./install.sh
```

What it does:
1. ✅ Detects Python 2/3 automatically
2. ✅ Installs pip if missing
3. ✅ Installs dependencies (tries user space first, then system)
4. ✅ Checks for tkinter GUI support
5. ✅ Provides platform-specific usage instructions

### Method 2: Manual Installation

If automated scripts fail, follow these manual steps:

#### Step 1: Install Python
Download and install Python 3.7+ from [python.org](https://python.org)

**Windows**: Check "Add Python to PATH" during installation
**macOS**: Use Homebrew (`brew install python3`)
**Linux**: Use your package manager:
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install python3 python3-pip python3-tk

# CentOS/RHEL
sudo yum install python3 python3-pip python3-tkinter

# Arch Linux
sudo pacman -S python python-pip tk
```

#### Step 2: Clone the Repository
```bash
git clone https://github.com/your-github-username/dino-production-flasher.git
cd dino-production-flasher
```

#### Step 3: Install Dependencies
```bash
# Navigate to the application directory
cd production_flasherv1.2

# Install Python packages
pip install -r requirements.txt

# Or with pip3
pip3 install -r requirements.txt

# On some systems, you might need sudo
sudo pip3 install -r requirements.txt
```

## 🔧 Configuration

### Basic Configuration
Edit `production_flasherv1.2/config.ini`:

```ini
[DEFAULT]
TARGET_HW_VERSION = 1.9.0
```

### Hardware Version
Make sure the `TARGET_HW_VERSION` matches the hardware revision of your ESP32-S3 devices.

## 🖥️ Usage

### Interactive Console (Recommended for beginners)
```bash
# Change to application directory
cd production_flasherv1.2

# Start interactive console
python dino_console.py 1.9.0

# Or use local DinoCore server
python dino_console.py 1.9.0 --local
```

### Available Console Commands
```bash
help                # Show all commands
devices            # List connected ESP32 devices
check production   # Check for latest production firmware
check testing      # Check for latest testing firmware
check update       # Check for application updates
update             # Install latest application version
flash testing 1    # Flash device (use device number from 'devices')
flash production 1 # Flash production firmware (IRREVERSIBLE!)
read efuse 1       # Read eFuse values from device
monitor 1          # Open serial monitor
burn efuse 1       # Burn hardware version to eFuse
quit               # Exit console
```

### GUI Applications
```bash
# Internal GUI interface
python gui_flasher.py

# Partner flasher (simplified GUI)
python partner_flasher.py

# Technician interface
python dino_technician_gui.py
```

### Automated Production Flashing
```bash
# Automated flashing (production environment)
python auto_flasher.py
```

## 🔄 Auto-Update System

The application includes automatic updates! Here's how to use it:

### From Console
```bash
# Inside dino_console.py
check update    # Check for updates
update         # Install latest version
```

### Direct Command
```bash
# From production_flasherv1.2 directory
python updater.py check   # Check for updates
python updater.py update  # Install updates
python updater.py update --yes  # Auto-confirm updates
```

### Update Features
- ✅ **Automatic Backup**: Creates backups before updating
- ✅ **Rollback Support**: Can restore previous version if needed
- ✅ **Dependency Updates**: Automatically updates Python packages
- ✅ **Version Tracking**: Tracks all updates and timestamps
- ✅ **Resume Downloads**: Handles interrupted downloads gracefully

## 🐛 Troubleshooting

### Common Installation Issues

#### "Python is not recognized" (Windows)
- Reinstall Python and check "Add Python to PATH"
- Or use full path: `C:\Python39\python.exe dino_console.py 1.9.0`

#### "pip not found" (Linux/macOS)
```bash
# Linux
sudo apt install python3-pip

# macOS
curl https://bootstrap.pypa.io/get-pip.py | python3
```

#### "tkinter not available" (GUI won't work)
```bash
# Ubuntu/Debian
sudo apt install python3-tk

# CentOS/RHEL
sudo yum install python3-tkinter

# macOS should include it by default
```

#### "Permission denied" when installing
```bash
# Use user-space installation
pip install --user -r requirements.txt

# Or with sudo (not recommended)
sudo pip install -r requirements.txt
```

### Common Runtime Issues

#### "Could not execute esptool"
```bash
pip install esptool pyserial
```

#### "No device found"
- Check USB connection
- Try different USB ports
- Verify hardware is powered on
- Check device drivers

#### "Network error"
- Check internet connection
- DinoCore API might be down
- Use `--local` flag for local development server

#### "Flash failed"
- Ensure stable power supply
- Try resetting the device
- Check firmware file integrity

### Update Issues

#### "Update failed"
- Check internet connection
- The backup directory has been created for rollback
- You can manually run the update script again

#### "Cannot rollback"
- Check if backup files exist in `backup/` directory
- Manual restoration might be needed

## 📦 Building Standalone Executables

### Windows Partner Flasher
```bash
# Install PyInstaller
pip install pyinstaller

# Build executable
pyinstaller DinoPartnerFlasher.spec --noconfirm

# Find executable in dist/ directory
```

### Linux/macOS Standalone
```bash
# Install PyInstaller
pip install pyinstaller

# Build executable
pyinstaller --onefile --windowed --add-data "testing_firmware:testing_firmware" partner_flasher.py
```

## 🎥 Demo Usage

Here's a complete example session:

```bash
# Install
./install.sh

# Navigate to app
cd production_flasherv1.2

# Start console
python dino_console.py 1.9.0

DinoCore Console Flasher
Type 'help' for commands

🦕 dino> devices
Found 1 potential ESP32 device(s):
  1. /dev/ttyACM0 - USB Serial Device

🦕 dino> check update
🔍 Checking for updates on GitHub...
✅ You're up to date! (version 1.2.0)

🦕 dino> check testing
🔄 Clearing testing firmware cache...
✅ Compatible testing firmware found

🦕 dino> flash testing 1
=== Testing Firmware Flashing ===
Target device: /dev/ttyACM0
✅ Testing firmware flash complete!

🦕 dino> burn efuse 1
=== eFuse Burning ===
✅ Hardware version burned to eFuse successfully!

🦕 dino> quit
Goodbye! 👋
```

## 🔒 Security Notes

- **eFuse Operations**: Hardware version burning is IRREVERSIBLE
- **Production Flashing**: Only use verified devices in production
- **Backup Files**: Sensitive configuration files are excluded from version control
- **Network Communication**: All updates use HTTPS for security

## 📞 Support

For issues, questions, or contributions:

1. **Check this document** - most common issues are covered here
2. **Review the troubleshooting section** in `README.md`
3. **Check GitHub Issues** for reported bugs
4. **Contact the development team** for specific issues

### Filing Bug Reports
When reporting issues, please include:
- Your operating system and Python version
- Complete command and error output
- Steps to reproduce the issue
- Hardware version of your ESP32 devices

---

Happy flashing! 🔧⚡🦕
