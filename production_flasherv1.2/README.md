# DinoCore Production Flasher

A comprehensive suite of Python-based tools for flashing and managing ESP32-S3 devices for the DinoCore project. The tools are designed for different use cases, from development to production and partner use.

## Project Overview

The core functionality revolves around `esptool` for flashing firmware, `pyserial` for device communication, and `requests` for interacting with the DinoCore API to fetch firmware builds.

## Features

- **Interactive Console**: Command-line interface for developers with full device management capabilities
- **GUI Interface**: User-friendly graphical interface for internal use
- **Partner Flasher**: Simplified GUI application for external partners (standalone executable)
- **Automatic Flasher**: Production environment script for automated flashing
- **Firmware Management**: Automatic download of latest firmware from DinoCore API
- **eFuse Management**: Hardware version burning and reading capabilities
- **Serial Monitoring**: Real-time device communication and debugging
- **🔵 Bluetooth QC Testing**: Quality control testing via Bluetooth LE (optional)
- **🚀 Auto-Update System**: Automatic updates from GitHub with backup and rollback
- **📦 Version Management**: Centralized version tracking and changelog
- **🔍 Update Checks**: On-demand update checks and notifications
- **🌐 Multi-language Support**: English, Simplified Chinese, Traditional Chinese
- **📊 Advanced Logging**: Color-coded logs with different severity levels
- **🎨 Modern UI**: Dark theme with intuitive controls and status indicators

## Project Structure

```
production_flasherv1.2/
├── dino_console.py          # Interactive CLI for developers
├── gui_flasher.py           # GUI application for internal use
├── partner_flasher.py       # Simplified GUI for external partners
├── auto_flasher.py          # Automated production flashing script
├── download_helper.py       # Firmware download utilities
├── dino_technician_gui.py   # Technician interface
├── bluetooth_qc.py          # Bluetooth LE quality control testing
├── i18n_utils.py           # Internationalization utilities
├── updater.py              # Auto-update system
├── auto_updater_launcher.py # Update launcher
├── config.ini              # Configuration file
├── requirements.txt         # Python dependencies
├── install_dependencies.bat # Windows dependency installer
├── install_dependencies.sh  # Linux/Mac dependency installer
├── start_gui.bat           # Windows batch file to start GUI
├── start_gui.sh            # Linux/Mac shell script to start GUI
├── start_partner_flasher.bat # Windows batch file to start partner flasher
├── DinoPartnerFlasher.spec  # PyInstaller spec file for partner flasher
├── version.json            # Version and update information
├── CHANGELOG.md            # Changelog and release notes
├── INSTALL.md              # Detailed installation instructions
├── .github/                # GitHub workflows and templates
│   ├── workflows/
│   │   └── release.yml     # Automated release workflow
│   └── release-body.md     # Release template
└── README.md               # This file
```

## Installation

### Quick Setup (Recommended)

#### Windows
Double-click `install_dependencies.bat` to automatically install all dependencies.

#### Linux/Mac
Run the installation script:
```bash
./install_dependencies.sh
```

### Manual Installation

The project requires Python and the dependencies listed in `requirements.txt`.

To install the dependencies manually, run:

```bash
pip install -r requirements.txt
```

#### Required Dependencies
- `esptool>=4.0.0` - ESP32 flashing tool
- `pyserial>=3.5` - Serial communication
- `requests>=2.25.0` - HTTP requests for API communication
- `bleak>=0.19.0` - Bluetooth LE support for QC testing (optional)

#### Optional: Bluetooth QC Features
To enable Bluetooth Quality Control testing features, install:
```bash
pip install bleak>=0.19.0
```

Without bleak, the Bluetooth QC button will show as "BT UNAVAILABLE" but all other features will work normally.

#### Optional: Firebase Database Integration
To enable cloud data storage for QC results and flash logs, install:
```bash
pip install firebase-admin>=6.0.0
```

Firebase allows you to:
- Store QC test results in the cloud
- Keep historical records of all flash operations
- Access data from multiple workstations
- Generate reports and analytics

To set up Firebase:
1. Run: `python firebase_db.py setup` (or double-click `setup_firebase.bat`)
2. Follow the instructions to create a Firebase project
3. Download credentials and place as `firebase-credentials.json`
4. Run: `python firebase_db.py init` to test the connection

Without firebase-admin, data logging will be disabled but all other features work normally.

## Configuration

Edit `config.ini` to set the target hardware version:

```ini
[DEFAULT]
TARGET_HW_VERSION = 1.9.0
```

## Usage

### Dino Console (for developers)

The interactive command-line interface supports:

- Listing connected devices
- Checking for and downloading latest production and testing firmware
- Flashing both production and testing firmware
- Burning hardware versions to the eFuse
- Reading eFuse values
- Serial monitor for debugging

To run the interactive console:

```bash
python dino_console.py <hardware_version>
```

For example:

```bash
python dino_console.py 1.9.0
```

To use the local development server:

```bash
python dino_console.py <hardware_version> --local
```

### GUI Flasher (for internal use)

A graphical user interface that provides:

- Automatic detection and flashing of new devices
- Switching between "production" and "testing" modes
- Display of logs and progress

To run the GUI flasher:

```bash
python gui_flasher.py
```

### Partner Flasher (for external partners)

A simplified GUI application designed to be a standalone executable. It includes the necessary firmware and only supports a "testing" mode, which burns the eFuse and flashes the testing firmware.

To build the executable:

```bash
pyinstaller DinoPartnerFlasher.spec
```

The executable will be created in the `dist` directory.

### Auto Flasher (for production)

A script for automated flashing in a production environment that continuously scans for new devices and flashes them with the production firmware.

To run the auto flasher:

```bash
python auto_flasher.py
```

## Bluetooth QC Testing

The GUI includes an optional Bluetooth Quality Control testing feature that allows testing microphone balance and other quality metrics via Bluetooth LE.

### Bluetooth QC Features

- **Device Scanning**: Automatically scans for QA-enabled DinoCore devices
- **Microphone Testing**: Tests left/right microphone balance with configurable thresholds
- **Quality Metrics**: Measures RMS levels and evaluates audio quality
- **Test Results**: Displays detailed results with PASS/FAIL status
- **Real-time Monitoring**: Live feedback during testing process

### Enabling Bluetooth QC

1. **Install bleak library**:
   ```bash
   pip install bleak>=0.19.0
   ```

2. **Ensure Bluetooth compatibility**:
   - Windows: Bluetooth drivers must be installed and working
   - Linux: bluetoothctl must be available
   - macOS: Bluetooth must be enabled

3. **In the GUI**:
   - The "BT UNAVAILABLE" button will change to "🔵 BLUETOOTH QC"
   - Click to start scanning for QA devices
   - Follow on-screen instructions for testing

### Bluetooth QC Requirements

- **Hardware**: QA-enabled DinoCore devices with Bluetooth LE
- **Software**: bleak library installed
- **Permissions**: Bluetooth access permissions on the system
- **Range**: Devices must be within Bluetooth range (~10m)

## Hardware Requirements

- ESP32-S3 devices
- USB-to-Serial adapter (for flashing)
- Windows/Linux/Mac OS with Python 3.7+

## Dependencies

- `esptool>=4.0.0` - ESP32 flashing tool
- `pyserial>=3.5` - Serial communication
- `requests>=2.25.0` - HTTP requests for API communication
- `tkinter` - GUI framework (included with Python)

## API Integration

The tools communicate with the DinoCore API at:
`https://dinocore-telemetry-production.up.railway.app/`

- Fetches available firmware builds
- Downloads firmware files automatically
- Supports both production and testing firmware versions

## Development Conventions

### Firmware Management
The tools fetch firmware from the DinoCore API. The `dino_console.py` and `gui_flasher.py` download firmware on demand, while the `partner_flasher.py` is designed to have the firmware bundled with it.

### eFuse Burning
The `dino_console.py` and `gui_flasher.py` have explicit commands for burning the hardware version to the eFuse. This is a one-time, irreversible operation. The `partner_flasher.py` automatically attempts to burn the eFuse as part of its "testing" mode.

### Modes
The tools have different modes ("production" and "testing") that determine which firmware is used and whether eFuses are burned.

### Error Handling
The tools include error handling for common issues like missing devices, failed flashing operations, and network errors.

### GUI
The GUI tools are built with `tkinter`.

## Safety Notes

- **eFuse Burning**: Testing mode burns hardware version to eFuse. This is irreversible!
- **Production Mode**: Only flashes devices that have been properly tested and have valid eFuse versions
- **Backup**: Always backup important data before flashing
- **Power**: Ensure stable power supply during flashing operations

## Troubleshooting

### Common Issues

1. **"Could not execute esptool"**
   - Ensure esptool is installed: `pip install esptool`

2. **"No compatible firmware found"**
   - Check network connection
   - Verify hardware version in config.ini
   - Check DinoCore API status

3. **"Device not found"**
   - Check USB connection
   - Try different USB port
   - Verify device drivers

4. **"Flash failed"**
   - Check device power
   - Try resetting device
   - Verify firmware files integrity

## Development

### Adding New Features

1. Firmware download logic in `download_helper.py`
2. GUI components in `gui_flasher.py`
3. Serial communication in respective modules

### Building Executables

Use PyInstaller with the provided spec files:

```bash
pyinstaller DinoPartnerFlasher.spec
```

## License

[Add license information here]

## Support

For support and questions:
- Check the troubleshooting section
- Review device logs in the GUI
- Contact the development team

---

**Warning**: This software is designed for production use. Always test on development devices first and follow proper safety procedures when working with hardware.
