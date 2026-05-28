@echo off
title Back up to GitHub
cd /d "%~dp0"

echo.
echo Backing up Fatigue app to GitHub...
echo.

git add .
if errorlevel 1 (
    echo Git add failed. Is Git installed and is this folder a Git repo?
    goto end
)

git diff --staged --quiet 2>nul
if errorlevel 1 (
    git commit -m "Back up - %date% %time%"
    if errorlevel 1 (
        echo Commit failed. Check the message above.
        goto end
    )
    echo Committed.
) else (
    echo No changes to commit. Your files match the last commit.
)

git push origin HEAD
if errorlevel 1 (
    echo.
    echo Push failed. You may need to sign in:
    echo - Use your GitHub username and a Personal Access Token as password.
    echo - Create a token at https://github.com/settings/tokens ^(tick repo^).
    goto end
)

echo.
echo Done. Your latest changes are on GitHub.
goto end

:end
echo.
pause
