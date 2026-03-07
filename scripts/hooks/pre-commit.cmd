@echo off
REM Copyright (c) 2026 Michael Welter <me@mikinho.com>
REM MIT License

setlocal enabledelayedexpansion
set "FILES="
for /f "delims=" %%i in ('git diff --cached --name-only --diff-filter=ACMRTUXB') do (
    set "FILES=!FILES! %%i"
)
if defined FILES (
    call npx eslint --no-warn-ignored !FILES!
)
