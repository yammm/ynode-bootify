@echo off
REM Copyright (c) 2026 Michael Welter <me@mikinho.com>
REM MIT License

setlocal enabledelayedexpansion
set "FILES="
for /f "delims=" %%i in ('git diff --cached --name-only --diff-filter=ACMRTUXB') do (
    set "FILES=!FILES! %%i"
)

if defined FILES (
    echo [pre-commit] Running Prettier...
    call npx prettier --check --ignore-unknown !FILES!
    if !errorlevel! neq 0 exit /b 1

    echo [pre-commit] Running ESLint...
    call npx eslint --no-warn-ignored !FILES!
    if !errorlevel! neq 0 exit /b 1
)

echo [pre-commit] Running Test Suite...
call npm test
if %errorlevel% neq 0 exit /b 1

echo [pre-commit] All checks passed!
exit /b 0
