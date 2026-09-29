# BSF Command Center - remove the iPad remote firewall permission.
$RuleName = 'BSF Command Center iPad Remote'
Remove-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
Write-Host ''
Write-Host '  The BSF Command Center iPad Remote firewall rule has been removed.' -ForegroundColor Green
Write-Host '  (Your network type was not changed. Change it in Settings if you wish.)'
Write-Host ''
