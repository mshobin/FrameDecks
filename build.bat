@echo off
setlocal
REM ------------------------------------------------------------------
REM  Builds BSF-Command-Center-Setup-<version>.exe on THIS PC.
REM  (The usual way is GitHub Actions - see BUILD-AND-INSTALL.md.)
REM  Needs: Python 3.10 or newer, and Inno Setup 6 (free, jrsoftware.org).
REM ------------------------------------------------------------------
cd /d "%~dp0"

set "PY=python"
where py >nul 2>nul && set "PY=py -3"

echo.
echo  [1/5] Preparing a private build environment...
if not exist ".build-venv\Scripts\python.exe" %PY% -m venv .build-venv || goto :fail
call ".build-venv\Scripts\activate.bat" || goto :fail

echo  [2/5] Installing build tools (first time takes a few minutes)...
python -m pip install --upgrade pip >nul || goto :fail
python -m pip install -r packaging\requirements-desktop.txt || goto :fail

echo  [2b] BCC vCam camera...
if exist "vcam\bin\bcc_vcam64.dll" goto :vcamdone
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if not exist "%VSWHERE%" goto :novcam
for /f "usebackq delims=" %%m in (`"%VSWHERE%" -latest -requires Microsoft.Component.MSBuild -find MSBuild\**\Bin\MSBuild.exe`) do set "MSBUILD=%%m"
if not defined MSBUILD goto :novcam
where git >nul 2>nul || goto :novcam
if not exist "vcam_build\softcam" (
  git clone --depth 1 --branch v1.8.1 https://github.com/tshino/softcam.git vcam_build\softcam || goto :fail
  python packaging\build_vcam.py vcam_build\softcam || goto :fail
)
"%MSBUILD%" vcam_build\softcam\softcam.sln /m /t:softcam /p:Configuration=Release /p:Platform=x64 || goto :fail
"%MSBUILD%" vcam_build\softcam\softcam.sln /m /t:softcam /p:Configuration=Release /p:Platform=Win32 || goto :fail
copy /y "vcam_build\softcam\x64\Release\softcam.dll" "vcam\bin\bcc_vcam64.dll" >nul || goto :fail
copy /y "vcam_build\softcam\Win32\Release\softcam.dll" "vcam\bin\bcc_vcam32.dll" >nul || goto :fail
goto :vcamdone
:novcam
echo.
echo  NOTE: BCC vCam was skipped. Building it needs "Build Tools for Visual Studio" (free, with
echo  "Desktop development with C++") and Git. Everything else still builds. (GitHub builds it for you.)
echo.
:vcamdone

echo  [3/5] Self-check...
python packaging\check.py || goto :fail

echo  [4/5] Building the app...
pyinstaller --noconfirm --clean packaging\bsf.spec --distpath dist --workpath build || goto :fail
for /f "usebackq delims=" %%v in (`python packaging\get_version.py`) do set "VER=%%v"

echo  [5/5] Building the installer...
set "ISCC=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
if not exist "%ISCC%" set "ISCC=%ProgramFiles%\Inno Setup 6\ISCC.exe"
if not exist "%ISCC%" set "ISCC=%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe"
if not exist "%ISCC%" goto :noinno
"%ISCC%" /DAppVersion=%VER% packaging\installer.iss || goto :fail

echo.
echo  Done!  Your installer is:  dist\BSF-Command-Center-Setup-%VER%.exe
echo.
pause
exit /b 0

:noinno
echo.
echo  Inno Setup 6 was not found. Install it (free) from https://jrsoftware.org/isdl.php
echo  or run:  winget install JRSoftware.InnoSetup   then run build.bat again.
echo  (The app itself was built in: dist\BSF Command Center)
echo.
pause
exit /b 1

:fail
echo.
echo  The build stopped because of the error shown above.
echo.
pause
exit /b 1
