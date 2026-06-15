@echo off
title Circadia Command
cd /d "%~dp0circadia-command"
if errorlevel 1 (
  echo ERROR: Could not open circadia-command folder.
  pause
  exit /b 1
)

node --version >nul 2>&1
if errorlevel 1 (
  echo Install Node.js from https://nodejs.org then run again.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
)

if not exist ".env" (
  echo Copying .env from app-next Neon URL if available...
  if exist "..\app-next\.env.local" (
    findstr "DATABASE_URL" "..\app-next\.env.local" > .env
    echo COMMAND_DEV_OPERATOR_EMAIL=operator@circadia.local>> .env
  ) else (
    copy .env.example .env
    echo Edit circadia-command\.env and set DATABASE_URL, then run again.
    pause
    exit /b 0
  )
)

echo Starting Circadia Command on http://localhost:3001/triage
start "Circadia Command" cmd /k "cd /d ""%~dp0circadia-command"" && npm run dev"
timeout /t 8 /nobreak >nul
start "" "http://localhost:3001/login"
echo Keep the Circadia Command window open while using the app.
pause
