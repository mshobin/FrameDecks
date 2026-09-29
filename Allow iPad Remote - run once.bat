@echo off
title Allow iPad Remote - BSF Command Center
set "BSF_SELF=%~f0"
set "BSF_DIR=%~dp0"
net session >nul 2>&1
if %errorlevel%==0 goto admin
echo.
echo  This needs administrator permission to change the firewall.
echo  Windows will ask you now - please select Yes.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Start-Process -FilePath $env:BSF_SELF -Verb RunAs -ErrorAction Stop } catch { Write-Host '  Permission was not given, so nothing was changed.'; exit 1 }"
if errorlevel 1 pause
exit /b
:admin
cd /d "%BSF_DIR%"
powershell -NoProfile -ExecutionPolicy Bypass -File "%BSF_DIR%tools\allow-ipad-remote.ps1"
echo.
echo  A copy of this report was saved as ipad-remote-check.txt in the
echo  BSF Command Center folder.
echo.
pause
