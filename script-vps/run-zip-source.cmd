@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0zip-source.ps1" %*
exit /b %errorlevel%
