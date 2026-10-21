@echo off
REM Registers the FrameCast camera with Windows (needs administrator permission).
"%SystemRoot%\System32\regsvr32.exe" /s "%~dp0framecast_vcam64.dll"
if exist "%SystemRoot%\SysWOW64\regsvr32.exe" if exist "%~dp0framecast_vcam32.dll" "%SystemRoot%\SysWOW64\regsvr32.exe" /s "%~dp0framecast_vcam32.dll"
