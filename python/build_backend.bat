@echo off
echo Building Python Backend...

call venv\Scripts\activate
pip install pyinstaller

echo Cleaning previous builds...
rmdir /s /q build
rmdir /s /q dist

echo Running PyInstaller...
pyinstaller --noconfirm --clean ^
    --name diktate-engine ^
    --onefile ^
    --windowed ^
    --paths . ^
    ipc_server.py

echo Build complete. executable is in python/dist/diktate-engine.exe
