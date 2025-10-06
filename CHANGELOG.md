# DinoCore Production Flasher Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2025-10-06

### 🚀 Added
- **Auto-Update System**: Automatic update checker and installer from GitHub releases
- **Backup & Rollback**: Automatic backups before updates with one-click rollback functionality
- **GitHub Integration**: Full GitHub repository management and release automation
- **Version Management**: Centralized version tracking with JSON metadata
- **Update CLI**: Command-line interface for update operations (`python updater.py check/update`)
- **Installation Scripts**: One-click installers for Windows (`install.bat`) and Unix (`install.sh`)
- **GitHub Actions**: Automated CI/CD pipeline for releases and testing

### 🔧 Changed
- **CLI Interface**: Enhanced command-line interface with update commands
- **Project Structure**: Better organization with update system integration
- **Documentation**: Updated README and installation guides

### 🔒 Security
- **Backup System**: Secure backup restoration in case of update failures
- **Rollback Protection**: Safe rollback to previous versions
- **Network Security**: HTTPS-only communications with GitHub API

### 📦 Dependencies
- **Dependency Updates**: Enhanced dependency management during updates
- **Requirements Management**: Automatic pip upgrades during updates

## [1.1.0] - 2025-10-01

### 🚀 Added
- **Partner Flasher**: Simplified GUI application for external partners (PyInstaller executable)
- **Auto Flasher**: Production environment script for automated flashing
- **Technician GUI**: Enhanced interface for technician operations
- **Serial Communication**: Improved ESP32 device detection and monitoring
- **API Integration**: Better integration with DinoCore API for firmware management

### 🔧 Changed
- **GUI Improvements**: Enhanced user interface for all GUI applications
- **Error Handling**: Better error handling and user feedback
- **Performance**: Optimized firmware download and flashing processes

### 🐛 Fixed
- **Device Detection**: Improved ESP32 device detection across platforms
- **Serial Stability**: Fixed serial communication issues on Windows/macOS

## [1.0.0] - 2025-09-15

### 🚀 Added
- **Initial Release**: DinoCore Production Flasher v1.0.0
- **Interactive Console**: Command-line interface for developers
- **GUI Flasher**: User-friendly graphical interface for internal use
- **Firmware Management**: Download and management of production/testing firmware
- **eFuse Burning**: Hardware version burning and reading capabilities
- **Serial Monitoring**: Real-time device communication and debugging
- **ESP32-S3 Support**: Full support for ESP32-S3 flashing operations
- **Cross-Platform**: Windows, macOS, and Linux compatibility

### 📋 Dependencies
- `esptool>=4.0.0`
- `pyserial>=3.5`
- `requests>=2.25.0`

---

## Types of changes
- `🚀 Added` for new features
- `🔧 Changed` for changes in existing functionality
- `🐛 Fixed` for any bug fixes
- `🔒 Security` in case of vulnerabilities
- `📦 Dependencies` for dependency updates

## Version Numbering
This project uses [Semantic Versioning](https://semver.org/):
- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible functionality additions
- **PATCH** version for backwards-compatible bug fixes

## Release Process
1. Update version in `version.json`
2. Update `CHANGELOG.md` with new changes
3. Create Git tag: `git tag v1.2.0`
4. Push tag: `git push origin v1.2.0`
5. GitHub Actions automatically creates release with ZIP asset
6. Update system pulls latest release automatically

---

### Contributing to Changelog
When contributing changes:
1. Add entries under `[Unreleased]` section at the top
2. Use appropriate type prefixes (🚀 Added, 🔧 Changed, 🐛 Fixed, etc.)
3. Group similar changes together
4. Reference issue/PR numbers when applicable

### Future Releases
- [ ] Enhanced error recovery systems
- [ ] Batch processing for multiple devices
- [ ] Advanced logging and telemetry
- [ ] Plugin system for custom operations
