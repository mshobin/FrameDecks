@echo off
title Undo iPad Remote permission - FRAMEDECKS
set "KC_SELF=%~f0"
set "KC_DIR=%~dp0"
net session >nul 2>&1
if %errorlevel%==0 goto admin
echo  Windows will ask for permission - please select Yes.
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Start-Process -FilePath $env:KC_SELF -Verb RunAs -ErrorAction Stop } catch { Write-Host '  Permission was not given, so nothing was changed.'; exit 1 }"
if errorlevel 1 pause
exit /b
:admin
powershell -NoProfile -ExecutionPolicy Bypass -File "%KC_DIR%tools\undo-ipad-remote.ps1"
pause
