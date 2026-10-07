@echo off
cd /d "%~dp0"
if not exist node_modules\electron\install.js (
  call npm.cmd ci --no-audit --no-fund
  if errorlevel 1 goto failed
)
call npm.cmd run setup
if errorlevel 1 goto failed
call npm.cmd start
if errorlevel 1 goto failed
exit /b 0
:failed
echo Start failed. See the message above.
pause
exit /b 1
