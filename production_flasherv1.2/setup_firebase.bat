@echo off
REM DinoCore Production Flasher - Firebase Setup
REM This script helps set up Firebase database integration

echo.
echo 🔥 ========================================
echo 🔥  DinoCore Firebase Setup
echo 🔥 ========================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed!
    echo    Please install Python 3.7 or higher first.
    echo.
    pause
    exit /b 1
)

echo ✅ Python found
echo.

REM Check if firebase_db module is available
python -c "import firebase_db; print('Firebase module available')" 2>nul
if errorlevel 1 (
    echo ❌ Firebase module not found!
    echo    Make sure firebase_db.py is in the same directory.
    echo.
    pause
    exit /b 1
)

echo ✅ Firebase module found
echo.

REM Ask for project ID
set /p project_id="Enter your Firebase project ID (or press Enter for 'dinocore-production'): "

if "%project_id%"=="" (
    set project_id=dinocore-production
)

echo.
echo Using project ID: %project_id%
echo.

REM Run Firebase setup
echo 🔄 Running Firebase setup...
python firebase_db.py setup %project_id%

if errorlevel 1 (
    echo.
    echo ❌ Firebase setup failed
    pause
    exit /b 1
)

echo.
echo ✅ Firebase setup completed!
echo.
echo Next steps:
echo 1. Go to Firebase Console: https://console.firebase.google.com/
echo 2. Select your project: %project_id%
echo 3. Go to Project Settings ^> Service Accounts
echo 4. Click "Generate new private key"
echo 5. Download the JSON file
echo 6. Rename it to "firebase-credentials.json"
echo 7. Place it in the production_flasherv1.2 directory
echo.
echo After that, run: python firebase_db.py init
echo.

pause
