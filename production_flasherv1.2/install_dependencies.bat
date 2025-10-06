@echo off
REM DinoCore Production Flasher - Install Dependencies
REM This script installs all required dependencies for the DinoCore Production Flasher

echo.
echo 🦕 ========================================
echo 🦕  DinoCore Production Flasher Setup
echo 🦕 ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed!
    echo    Please install Python 3.7 or higher from https://python.org
    echo.
    pause
    exit /b 1
)

echo ✅ Python found
echo.

REM Check if pip is available
pip --version >nul 2>&1
if errorlevel 1 (
    echo ❌ pip is not available!
    echo    Please install pip first.
    echo.
    pause
    exit /b 1
)

echo ✅ pip found
echo.

REM Upgrade pip first
echo 🔄 Upgrading pip...
python -m pip install --upgrade pip
if errorlevel 1 (
    echo ❌ Failed to upgrade pip
    echo.
    pause
    exit /b 1
)

echo ✅ pip upgraded successfully
echo.

REM Install required packages
echo 🔄 Installing required packages...
echo    This may take a few minutes...

REM Core dependencies
echo    Installing esptool...
python -m pip install esptool>=4.0.0

echo    Installing pyserial...
python -m pip install pyserial>=3.5

echo    Installing requests...
python -m pip install requests>=2.25.0

REM Bluetooth LE support (optional but recommended)
echo    Installing bleak for Bluetooth QC...
python -m pip install bleak>=0.19.0

echo.
echo ✅ All dependencies installed successfully!
echo.

REM Verify installations
echo 🔍 Verifying installations...
echo.

python -c "import esptool; print('✅ esptool OK')" 2>nul
if errorlevel 1 (
    echo ❌ esptool installation failed
) else (
    echo ✅ esptool installed correctly
)

python -c "import serial; print('✅ pyserial OK')" 2>nul
if errorlevel 1 (
    echo ❌ pyserial installation failed
) else (
    echo ✅ pyserial installed correctly
)

python -c "import requests; print('✅ requests OK')" 2>nul
if errorlevel 1 (
    echo ❌ requests installation failed
) else (
    echo ✅ requests installed correctly
)

python -c "import bleak; print('✅ bleak OK')" 2>nul
if errorlevel 1 (
    echo ⚠️ bleak installation failed - Bluetooth QC will be disabled
    echo    To enable Bluetooth QC, install manually: pip install bleak
) else (
    echo ✅ bleak installed correctly - Bluetooth QC enabled
)

echo.
echo 🎉 Setup completed!
echo.
echo You can now run the DinoCore Production Flasher:
echo    - Double-click: start_gui.bat
echo    - Or run: python gui_flasher.py
echo.
echo If you encounter any issues, make sure:
echo    - Python 3.7+ is installed
echo    - All dependencies are installed
echo    - Windows Bluetooth drivers are up to date (for QC features)
echo.

pause
