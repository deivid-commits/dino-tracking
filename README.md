# DinoCore Production Flasher

[![Latest Release](https://img.shields.io/github/v/release/deivid-commits/dino-production-flasher)](https://github.com/deivid-commits/dino-production-flasher/releases)
[![Python Version](https://img.shields.io/badge/python-3.7+-blue)](https://python.org)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

A comprehensive, **self-updating** Python-based tool suite for flashing and managing ESP32-S3 devices for the DinoCore project. Features automatic updates from GitHub, backup/rollback capabilities, and multi-platform support.

## 🚀 Quick Start (1 minute setup)

### Windows
```batch
git clone https://github.com/deivid-commits/dino-production-flasher.git
cd dino-production-flasher
install.bat
```

### Linux/macOS
```bash
git clone https://github.com/deivid-commits/dino-production-flasher.git
cd dino-production-flasher
chmod +x install.sh && ./install.sh
```

Then use the interactive console:
```bash
cd production_flasherv1.2
python dino_console.py 1.9.0
```

## ✨ New in v1.2.0: Self-Updating System

- 🔄 **Automatic Updates**: One-command updates from GitHub releases
- 💾 **Safe Backups**: Automatic backups before any update
- 🔙 **One-Click Rollback**: Restore previous versions instantly
- ✅ **Cross-Platform**: Works on Windows, macOS, and Linux
- 🔒 **Secure**: HTTPS-only downloads from GitHub

## 🎯 Features

- **🖥️ Interactive Console**: Developer-friendly CLI with 15+ commands
- **🖼️ GUI Applications**: Multiple graphical interfaces for different use cases
- **⚡ ESP32-S3 Support**: Full flashing, monitoring, and eFuse management
- **🔍 Device Detection**: Automatic ESP32 device discovery
- **🔄 Auto-Updates**: Self-updating from GitHub releases (automatic on startup)
- **💾 Backup/Restore**: Safe update rollback capabilities
- **🔧 Hardware Security**: eFuse version burning and reading
- **📡 API Integration**: DinoCore server communication
- **🌍 Multi-Platform**: Windows, macOS, Linux support

## 📝 Usage Examples

### Interactive Console (Recommended)
```bash
# Start the console
python dino_console.py 1.9.0

🦕 dino> help                    # Show all commands
🦕 dino> devices                # List connected ESP32 devices
🦕 dino> check update           # Check for application updates
🦕 dino> update                 # Install latest version
🦕 dino> check testing          # Download latest testing firmware
🦕 dino> flash testing 1        # Flash device #1 with testing firmware
🦕 dino> burn efuse 1           # Burn hardware version to eFuse (permanent!)
🦕 dino> flash production 1     # Flash final production firmware
🦕 dino> monitor 1              # Open serial monitor
```

### Direct Commands
```bash
# Update system
python updater.py check          # Check for updates
python updater.py update         # Install updates
python updater.py update --yes   # Auto-confirm updates

# GUI applications (with auto-update)
start_gui.bat                    # 🆕 Main GUI + Auto-updates on startup (Windows)
./start_gui.sh                   # 🆕 Main GUI + Auto-updates on startup (Linux/macOS)
python auto_updater_launcher.py  # Auto-update launcher (all platforms)
python gui_flasher.py            # Main GUI interface (no auto-update)

# Other GUI applications
python partner_flasher.py        # Partner interface
python dino_technician_gui.py    # Technician interface

# Automated production flashing
python auto_flasher.py           # Production automation
```

## 🏗️ Project Structure

```
production_flasherv1.2/           # Main application
├── dino_console.py              # Interactive console (main entry point)
├── gui_flasher.py               # Main GUI application
├── partner_flasher.py           # Partner GUI (standalone executable)
├── auto_flasher.py              # Production automation
├── updater.py                   # 🆕 Auto-update system
├── auto_updater_launcher.py     # 🆕 Auto-update launcher (cross-platform)
├── version.json                 # 🆕 Version tracking
├── config.ini                   # Configuration
├── requirements.txt             # Python dependencies
│
├── backup/                      # 🆕 Auto-created backups
├── testing_firmware/            # Downloaded firmware
├── production_firmware/         # Downloaded firmware
└── *.py                         # Supporting modules

# Auto-update launchers (by platform)
start_gui.bat                    # 🆕 Windows: GUI + Auto-update on launch
start_gui.sh                     # 🆕 Linux/macOS: GUI + Auto-update on launch

.github/workflows/release.yml     # 🆕 CI/CD automation
install.bat / install.sh          # 🆕 Cross-platform installers
CHANGELOG.md                      # 🆕 Version history
INSTALL.md                        # 🆕 Detailed installation guide
```

## 🔄 Update System

The application includes a sophisticated update system:

### Features
- **📥 Download Management**: Resumable downloads from GitHub releases
- **💾 Automatic Backups**: Pre-update backups of configuration and scripts
- **🔙 Rollback Support**: One-click restoration of previous versions
- **📦 Dependency Updates**: Automatic pip package updates
- **🔍 Version Checking**: Real-time version comparison with GitHub
- **🔒 Secure Updates**: HTTPS-only, signature-verified downloads

### Usage
```bash
# In console
🦕 dino> check update           # Check current version vs latest
🦕 dino> update                 # Download and install updates

# Direct commands
python updater.py check
python updater.py update --yes   # Skip confirmation prompts
```

## 🛠️ System Requirements

### Minimum
- **OS**: Windows 10+, macOS 10.12+, Ubuntu 16.04+
- **Python**: 3.7 or higher
- **RAM**: 512 MB
- **Storage**: 100 MB free space

### Hardware
- **ESP32-S3 devices** for flashing
- **USB-to-serial adapter** (FTDI, CH340, CP2102, etc.)
- **USB cable** for device connection

## 📦 Installation Options

### 1. Automated (Recommended)
Use the platform-specific installers included in the repository.

### 2. Manual Installation
```bash
# Clone repository
git clone https://github.com/deivid-commits/dino-production-flasher.git
cd dino-production-flasher

# Install dependencies
cd production_flasherv1.2
pip install -r requirements.txt
```

### 3. Download Release
Download the latest release ZIP from [GitHub Releases](https://github.com/deivid-commits/dino-production-flasher/releases) and extract.

## 🔒 Security & Safety

⚠️ **Important**: eFuse operations are **irreversible**. The `burn efuse` command permanently writes hardware version information to your ESP32 device.

- **Testing Mode**: Safe for development and prototyping
- **Production Mode**: Only use on verified, production-ready devices
- **Backup Files**: Always create backups before flashing
- **Power Supply**: Ensure stable power during flashing operations

## 🐛 Troubleshooting

### Common Issues
- **"No device found"**: Check USB connections and drivers
- **"esptool not found"**: Ensure dependencies are installed correctly
- **"Network error"**: Check internet connection for firmware downloads
- **"Permission denied"**: Use `sudo` on Linux/macOS, or run as administrator on Windows

### Update Issues
- **"Update failed"**: Check internet connection and available disk space
- **"Rollback needed"**: Backups are automatically created in `backup/` directory
- **"Version conflict"**: Clear browser cache and try again

See [INSTALL.md](INSTALL.md) for detailed troubleshooting guides.

## 📊 Version History

See [CHANGELOG.md](CHANGELOG.md) for complete version history and release notes.

## 📞 Support

- **📖 Documentation**: [INSTALL.md](INSTALL.md) - Complete installation guide
- **🐛 Issues**: [GitHub Issues](https://github.com/deivid-commits/dino-production-flasher/issues)
- **✅ Releases**: [GitHub Releases](https://github.com/deivid-commits/dino-production-flasher/releases)
- **🔄 Changelog**: [CHANGELOG.md](CHANGELOG.md) - Version history

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Update documentation
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Built with ❤️ for the DinoCore project** 🦕⚡
