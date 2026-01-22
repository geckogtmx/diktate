@echo off
REM dIKtate Self-Testing Launcher
REM Choose between manual, automated, or meta testing

echo ========================================
echo dIKtate Self-Testing Launcher
echo ========================================
echo.
echo 1. Manual Testing (requires microphone)
echo 2. Automated Testing (uses synthesized speech)
echo 3. Meta-Test (self-referential testing)
echo 4. Exit
echo.
set /p choice="Choose testing mode (1-4): "

if "%choice%"=="1" (
    echo.
    echo Starting MANUAL self-test loop...
    echo You will need to read prompts aloud.
    echo.
    cd /d "%~dp0python"
    python self_test_loop.py
) else if "%choice%"=="2" (
    echo.
    echo Starting AUTOMATED self-test loop...
    echo This will use Windows speech synthesis.
    echo.
    cd /d "%~dp0python"
    python automated_self_test.py
) else if "%choice%"=="3" (
    echo.
    echo Starting META-TEST...
    echo Testing dIKtate's self-referential capability.
    echo.
    cd /d "%~dp0python"
    python meta_test.py
) else if "%choice%"=="4" (
    echo Exiting.
    exit /b
) else (
    echo Invalid choice. Please run again.
    pause
    exit /b 1
)

echo.
echo Testing complete! Check logs in:
echo C:\Users\gecko\.diktate\logs\
echo.
pause