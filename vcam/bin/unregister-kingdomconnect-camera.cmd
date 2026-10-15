@echo off
REM Removes the KingdomConnect camera from Windows (needs administrator permission).
"%SystemRoot%\System32\regsvr32.exe" /u /s "%~dp0kingdomconnect_vcam64.dll"
if exist "%SystemRoot%\SysWOW64\regsvr32.exe" if exist "%~dp0kingdomconnect_vcam32.dll" "%SystemRoot%\SysWOW64\regsvr32.exe" /u /s "%~dp0kingdomconnect_vcam32.dll"
