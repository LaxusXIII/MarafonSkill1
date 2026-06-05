@echo off
setlocal

cd /d "%~dp0"

set "HOST=127.0.0.1"
set "PORT=8123"
set "BUNDLED_PYTHON=C:\Users\home2\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
set "LOG=%~dp0server.log"

echo [%date% %time%] Starting Marathon Skills server > "%LOG%"
echo Folder: %cd% >> "%LOG%"

if exist "%BUNDLED_PYTHON%" (
  set "PYTHON=%BUNDLED_PYTHON%"
) else (
  where py >nul 2>nul
  if not errorlevel 1 (
    set "PYTHON=py"
  ) else (
    where python >nul 2>nul
    if not errorlevel 1 (
      set "PYTHON=python"
    ) else (
      echo Python was not found.
      echo Install Python or update BUNDLED_PYTHON in this file.
      pause
      exit /b 1
    )
  )
)

echo Marathon Skills is starting...
echo Open http://localhost:%PORT%/
echo Press Ctrl+C to stop the server.
echo.
echo Python: %PYTHON% >> "%LOG%"
echo URL: http://localhost:%PORT%/ >> "%LOG%"
echo. >> "%LOG%"

"%PYTHON%" -m http.server %PORT% --bind %HOST% 1>> "%LOG%" 2>>&1
echo Server stopped with code %errorlevel%. >> "%LOG%"
pause
