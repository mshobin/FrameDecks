@echo off
REM Removes the FrameDecks vCam from Windows (needs administrator permission).
setlocal
if defined ProgramW6432 (set "PF=%ProgramW6432%") else set "PF=%ProgramFiles%"
set "DEST=%PF%\FrameDecks vCam"
for %%f in ("%DEST%\framedecks_vcam64-*.dll") do "%SystemRoot%\System32\regsvr32.exe" /u /s "%%f"
if exist "%SystemRoot%\SysWOW64\regsvr32.exe" for %%f in ("%DEST%\framedecks_vcam32-*.dll") do "%SystemRoot%\SysWOW64\regsvr32.exe" /u /s "%%f"
REM before 9.3 the camera was registered from the program's own folder
if exist "%~dp0framedecks_vcam64.dll" "%SystemRoot%\System32\regsvr32.exe" /u /s "%~dp0framedecks_vcam64.dll"
if exist "%SystemRoot%\SysWOW64\regsvr32.exe" if exist "%~dp0framedecks_vcam32.dll" "%SystemRoot%\SysWOW64\regsvr32.exe" /u /s "%~dp0framedecks_vcam32.dll"
rmdir /s /q "%DEST%" 2>nul
exit /b 0
