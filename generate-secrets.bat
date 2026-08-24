@echo off
cd /d "%~dp0"

set NODE_EXE="C:\Users\Chuanchuan Feng\.workbuddy\binaries\node\versions\22.22.2\node.exe"

if not exist %NODE_EXE% (
  echo [ERROR] Node.js not found at: %NODE_EXE%
  echo Please install Node.js or edit this script to point to the correct path.
  pause
  exit /b 1
)

%NODE_EXE% "%~dp0generate-secrets.js"
if %errorlevel% neq 0 (
  echo.
  echo [ERROR] Failed to generate secrets. See messages above.
  pause
)
