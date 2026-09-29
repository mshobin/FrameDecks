@echo off
title Undo iPad Remote permission - BSF Command Center
set "BSF_SELF=%~f0"
set "BSF_DIR=%~dp0"
net session >nul 2>&1
if %errorlevel%==0 goto admin
echo  Windows will ask for permission - please select Yes.
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Start-Process -FilePath $env:BSF_SELF -Verb RunAs -ErrorAction Stop } catch { Write-Host '  Permission was not given, so nothing was changed.'; exit 1 }"
if errorlevel 1 pause
exit /b
:admin
powershell -NoProfile -ExecutionPolicy Bypass -File "%BSF_DIR%tools\undo-ipad-remote.ps1"
pause
