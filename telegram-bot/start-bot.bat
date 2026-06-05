@echo off
cd /d "%~dp0"
set "PYTHON=C:\Users\home2\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo Created .env from .env.example.
  echo Open telegram-bot\.env and fill TELEGRAM_BOT_TOKEN and SUPABASE_SERVICE_ROLE_KEY.
  pause
  exit /b 1
)

if exist "%PYTHON%" (
  "%PYTHON%" bot.py
) else (
  python bot.py
)

pause
