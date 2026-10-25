# FRAMEDECKS - remove the phone remote firewall permission.
@('FRAMEDECKS Phone Remote', 'Kingdom Connect Phone Remote', 'BSF Command Center iPad Remote') |
  ForEach-Object { Remove-NetFirewallRule -DisplayName $_ -ErrorAction SilentlyContinue }
Write-Host ''
Write-Host '  The FRAMEDECKS phone remote firewall permissions have been removed.' -ForegroundColor Green
Write-Host '  (Your network type was not changed. Change it in Settings if you wish.)'
Write-Host ''
