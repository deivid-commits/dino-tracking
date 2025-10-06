@echo off
REM DinoCore Production Flasher - Windows Installation Script
REM This script sets up the Python environment and installs dependencies

echo ===============================================
echo 🦕 DinoCore Production Flasher Installer
echo ===============================================
echo.

echo 📦 Checking Python installation...
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Python is not installed or not in PATH
    echo Please install Python 3.7+ from https://python.org
    echo Make sure to check "Add Python to PATH" during installation
    pause
    exit /b 1
)

echo ✅ Python found
echo.

echo 🔄 Checking pip installation...
pip --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ pip is not available
    echo This is unusual - Python installations should include pip
    pause
    exit /b 1
)

echo ✅ pip found
echo.

echo 📦 Installing/updating Python dependencies...
echo This may take a few minutes...
pip install -r production_flasherv1.2\requirements.txt

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to install dependencies
    echo Check the error messages above for details
    pause
    exit /b 1
)

echo ✅ Dependencies installed successfully
echo.

echo 🚀 Installation complete!
echo.
echo You can now use DinoCore Production Flasher by running:
echo.
echo   cd production_flasherv1.2
echo   python dino_console.py 1.9.0
echo.
echo For GUI mode:
echo   python gui_flasher.py
echo.
echo For updates, use:
echo   python updater.py check
echo   python updater.py update
echo.
echo Press any key to continue...
pause >nul
