@echo off
REM Keep path handling in Node so cmd.exe never reparses staged filenames.
node "%~dp0..\check-staged.mjs"
exit /b %errorlevel%
