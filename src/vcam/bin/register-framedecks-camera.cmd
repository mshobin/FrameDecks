@echo off
REM Registers the FrameDecks vCam with Windows (needs administrator permission).
REM 9.3 (production audit H4): the camera files are copied into a folder only administrators can change
REM (Program Files\FrameDecks vCam) and registered from there, so no program running as the user can swap the file
REM that every app with a camera loads. Each copy is named after the files' content (vcam-tag.txt, written by the
REM build), so a new camera never has to overwrite a copy an app still has open, and Windows asks again only when
REM the camera itself changed.
setlocal
set "TAG=local"
if exist "%~dp0vcam-tag.txt" set /p TAG=<"%~dp0vcam-tag.txt"
if defined ProgramW6432 (set "PF=%ProgramW6432%") else set "PF=%ProgramFiles%"
set "DEST=%PF%\FrameDecks vCam"
if not exist "%DEST%" mkdir "%DEST%" || exit /b 1
copy /y "%~dp0framedecks_vcam64.dll" "%DEST%\framedecks_vcam64-%TAG%.dll" >nul || exit /b 1
"%SystemRoot%\System32\regsvr32.exe" /s "%DEST%\framedecks_vcam64-%TAG%.dll" || exit /b 1
if exist "%SystemRoot%\SysWOW64\regsvr32.exe" if exist "%~dp0framedecks_vcam32.dll" (
  copy /y "%~dp0framedecks_vcam32.dll" "%DEST%\framedecks_vcam32-%TAG%.dll" >nul
  "%SystemRoot%\SysWOW64\regsvr32.exe" /s "%DEST%\framedecks_vcam32-%TAG%.dll"
)
REM older copies go; one an app still has open stays until the next time
for %%f in ("%DEST%\framedecks_vcam*.dll") do (
  if /i not "%%~nxf"=="framedecks_vcam64-%TAG%.dll" if /i not "%%~nxf"=="framedecks_vcam32-%TAG%.dll" del /q "%%f" 2>nul
)
exit /b 0
