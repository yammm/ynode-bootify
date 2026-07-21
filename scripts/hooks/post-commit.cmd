@echo off

REM >>> autover managed block >>>
where npx >nul 2>nul
IF ERRORLEVEL 1 (
    echo npx not found. Install Node.js/npm to use autover.
    EXIT /B 0
)
npx --no-install autover
REM <<< autover managed block <<<
