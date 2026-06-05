@echo off
setlocal

cd /d "%~dp0"

where npx >nul 2>nul
if errorlevel 1 (
  echo npx was not found.
  echo Install Node.js from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)

echo Deploying Marathon Skills to Vercel...
echo.
npx vercel --prod
pause
