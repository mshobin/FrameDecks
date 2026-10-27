@echo off
title FrameDecks
cd /d "%~dp0"
echo.
echo  Starting FrameDecks...
echo.
py -3 --version >nul 2>&1
if %errorlevel%==0 (
  py -3 src\server.py
  goto done
)
python --version >nul 2>&1
if %errorlevel%==0 (
  python src\server.py
  goto done
)
echo  Python 3 was not found on this computer.
echo.
echo  To use the overlays in OBS, Camo or Zoom, install Python 3 (free) from
echo  https://www.python.org/downloads/  and tick "Add python.exe to PATH"
echo  during setup. Then double-click this file again.
echo.
echo  Opening the dashboard in no-install mode for now. In this mode the
echo  overlays only update inside this same web browser.
echo.
start "" "app\dashboard.html"
:done
echo.
pause
