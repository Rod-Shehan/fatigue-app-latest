@echo off
title Deploy Fatigue App to Firebase

rem Always start from this script's folder
cd /d "%~dp0"

rem Move into the Next.js app folder
cd /d "%~dp0app-next"
if errorlevel 1 (
  echo ERROR: Could not open folder: %~dp0app-next
  pause
  exit /b 1
)

echo Working folder: %cd%
echo.

echo Using default Firebase project from app-next\.firebaserc
echo Calling scripts\firebase-deploy.cmd (no ID needed)
echo.
call scripts\firebase-deploy.cmd

