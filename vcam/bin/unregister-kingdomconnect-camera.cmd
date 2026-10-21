@echo off
REM Removes the KingdomConnect camera (needs administrator permission). See kingdomconnect-camera.ps1.
REM From a 32-bit program (the installer) System32 is redirected: Sysnative reaches the 64-bit PowerShell.
set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if exist "%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe" set "PS=%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe"
"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0kingdomconnect-camera.ps1" uninstall
