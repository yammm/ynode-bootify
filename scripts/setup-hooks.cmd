@echo off
REM Copyright (c) 2026 Michael Welter <me@mikinho.com>
REM MIT License

git rev-parse --git-dir >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Folder '%CD%' not part of a working git tree.
    exit /b 1
)

git config core.hooksPath scripts/hooks
echo Git hooks configured successfully to use 'scripts/hooks'
