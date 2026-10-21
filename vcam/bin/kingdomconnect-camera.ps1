# Installs or removes the KingdomConnect camera (runs as administrator; called by the two .cmd files next to it).
#   Windows 11: the Media Foundation camera (kingdomconnect_mfcam64.dll). Windows' Frame Server service loads it, and
#               that service cannot read files in a user's folder, so the file is copied to Program Files first.
#   Windows 10: the DirectShow camera (kingdomconnect_vcam64.dll / 32), registered where it is.
# Only one of the two is registered, so Zoom, Teams and OBS list KingdomConnect once.
param([ValidateSet('install', 'uninstall')][string]$Action = 'install')
$ErrorActionPreference = 'Continue'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$sys = "$env:SystemRoot\System32\regsvr32.exe"
$wow = "$env:SystemRoot\SysWOW64\regsvr32.exe"
$programFiles = if ($env:ProgramW6432) { $env:ProgramW6432 } else { $env:ProgramFiles }   # the 64-bit folder
$store = Join-Path $programFiles 'Kingdom Connect Camera'
$win11 = [Environment]::OSVersion.Version.Build -ge 22000
# Must match MF_CLSID in vcam/sink.py (the Windows 11 camera)
$mfClsid = '{06BACA0B-14C0-4E9B-8161-ED7D11F73518}'

function Reg([string]$exe, [string]$dll, [switch]$Remove) {
  if ((Test-Path $exe) -and (Test-Path $dll)) {
    $a = @('/s'); if ($Remove) { $a += '/u' }; $a += "`"$dll`""
    $p = Start-Process -FilePath $exe -ArgumentList $a -Wait -WindowStyle Hidden -PassThru
    Write-Output ("regsvr32 {0} {1}: exit {2}" -f ($(if ($Remove) { 'remove' } else { 'add' })), $dll, $p.ExitCode)
  }
}

function Remove-MFCam {
  if (Test-Path $store) {
    Get-ChildItem $store -Directory | ForEach-Object {
      Reg $sys (Join-Path $_.FullName 'kingdomconnect_mfcam64.dll') -Remove
      Reg $wow (Join-Path $_.FullName 'kingdomconnect_mfcam32.dll') -Remove
      Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue   # a copy still in use goes after a restart
    }
  }
  # then Windows' own entries for the camera, whatever happened above (both the 64- and the 32-bit view)
  foreach ($k in "Registry::HKEY_LOCAL_MACHINE\SOFTWARE\Classes\CLSID\$mfClsid",
                 "Registry::HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Classes\CLSID\$mfClsid") {
    if (Test-Path $k) {
      Remove-Item -Path $k -Recurse -Force -ErrorAction SilentlyContinue
      Write-Output ("removed {0}: {1}" -f $k, -not (Test-Path $k))
    }
  }
}

function Remove-DShowCam {
  Reg $sys (Join-Path $here 'kingdomconnect_vcam64.dll') -Remove
  Reg $wow (Join-Path $here 'kingdomconnect_vcam32.dll') -Remove
}

if ($Action -eq 'uninstall') {
  Remove-MFCam
  Remove-DShowCam
  if ((Test-Path $store) -and -not (Get-ChildItem $store)) { Remove-Item $store -Force -ErrorAction SilentlyContinue }
  exit 0
}

$mf64 = Join-Path $here 'kingdomconnect_mfcam64.dll'
if ($win11 -and (Test-Path $mf64)) {
  # a folder per build (named after the file's fingerprint): a copy Windows still has loaded is never overwritten
  $id = (Get-FileHash $mf64 -Algorithm SHA256).Hash.Substring(0, 12)
  $dest = Join-Path $store $id
  Remove-DShowCam
  if (Test-Path $store) {
    Get-ChildItem $store -Directory | Where-Object { $_.Name -ne $id } | ForEach-Object {
      Reg $sys (Join-Path $_.FullName 'kingdomconnect_mfcam64.dll') -Remove
      Reg $wow (Join-Path $_.FullName 'kingdomconnect_mfcam32.dll') -Remove
      Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  foreach ($f in 'kingdomconnect_mfcam64.dll', 'kingdomconnect_mfcam32.dll', 'LICENSE-VCamSample-MIT.txt') {
    $from = Join-Path $here $f
    if (Test-Path $from) { Copy-Item $from (Join-Path $dest $f) -Force }
  }
  Reg $sys (Join-Path $dest 'kingdomconnect_mfcam64.dll')
  Reg $wow (Join-Path $dest 'kingdomconnect_mfcam32.dll')
} else {
  Remove-MFCam
  Reg $sys (Join-Path $here 'kingdomconnect_vcam64.dll')
  Reg $wow (Join-Path $here 'kingdomconnect_vcam32.dll')
}
exit 0
