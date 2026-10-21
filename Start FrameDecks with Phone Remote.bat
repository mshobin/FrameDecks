@echo off
title FrameDecks (iPad remote ON)
cd /d "%~dp0"
echo.
echo  Starting FrameDecks with the iPad remote...
echo  If Windows asks whether Python may use the network, choose
echo  PRIVATE networks only, then select Allow.
echo.
py -3 --version >nul 2>&1
if %errorlevel%==0 (
  py -3 server.py --remote
  goto done
)
python --version >nul 2>&1
if %errorlevel%==0 (
  python server.py --remote
  goto done
)
echo  Python 3 was not found. The iPad remote needs the local program.
echo  Install Python 3 from https://www.python.org/downloads/ and tick
echo  "Add python.exe to PATH", then double-click this file again.
:done
echo.
pause
