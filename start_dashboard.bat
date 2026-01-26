@echo off
REM Quick start script for dIKtate History Dashboard

echo.
echo =========================================
echo dIKtate History Dashboard
echo =========================================
echo.
echo Starting dashboard on http://localhost:8765
echo.
echo Prerequisites:
echo   - Main app running (pnpm dev in another terminal)
echo   - Flask installed (pip install flask==3.0.0)
echo.
echo Press Ctrl+C to stop the dashboard
echo.
echo =========================================
echo.

cd python
python tools/history_dashboard.py
