## 🦕 DinoCore Production Flasher Release

This release contains the latest version of the DinoCore Production Flasher tool suite with automatic update capabilities.

### 📦 Downloads

- **[ZIP Archive](https://github.com/${{ github.repository }}/releases/download/${{ github.ref_name }}/dino-production-flasher-${{ env.VERSION }}.zip)** - Windows/Linux/macOS
- **[TAR.GZ Archive](https://github.com/${{ github.repository }}/releases/download/${{ github.ref_name }}/dino-production-flasher-${{ env.VERSION }}.tar.gz)** - Linux/macOS (smaller)

### 🚀 Installation

#### Quick Install (Recommended)

**Windows:**
```batch
# Download and run installer
install.bat
```

**Linux/macOS:**
```bash
# Download, make executable, and run installer
chmod +x install.sh
./install.sh
```

#### Manual Install
```bash
# Clone repository
git clone https://github.com/${{ github.repository }}.git
cd dino-production-flasher

# Install dependencies
cd production_flasherv1.2
pip install -r requirements.txt
```

### 🆕 What's New

<!-- This section will be populated from CHANGELOG.md during build -->

### 🎯 Key Features

- **Interactive Console**: Developer-friendly command-line interface
- **GUI Applications**: User-friendly graphical interfaces for different use cases
- **Automatic Updates**: Built-in update system with GitHub integration
- **ESP32-S3 Support**: Full flashing and management capabilities
- **Multi-Platform**: Works on Windows, macOS, and Linux
- **Hardware Security**: eFuse management for version burning

### 🖥️ Usage

```bash
# Start interactive console
python dino_console.py 1.9.0

# Check for updates
🦕 dino> check update

# Install updates
🦕 dino> update

# List connected devices
🦕 dino> devices

# Flash testing firmware
🦕 dino> check testing
🦕 dino> flash testing 1
```

### 🔒 Security Notes

- **eFuse Operations**: Version burning is irreversible
- **Production Flash**: Only use on verified production devices
- **HTTPS Updates**: All updates use secure HTTPS connections

### 🔧 System Requirements

- **Python**: 3.7 or higher
- **ESP32-S3**: Target hardware for flashing
- **USB Serial**: FTDI, CH340, CP2102, or similar adapter

### 📞 Support

- **Issues**: [GitHub Issues](https://github.com/${{ github.repository }}/issues)
- **Documentation**: [INSTALL.md](https://github.com/${{ github.repository }}/blob/main/INSTALL.md)
- **Changelog**: [CHANGELOG.md](https://github.com/${{ github.repository }}/blob/main/CHANGELOG.md)

---

**Happy Flashing! 🔧⚡🦕**
