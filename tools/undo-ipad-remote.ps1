# Kingdom Connect - remove the phone remote firewall permission.
$RuleName = 'Kingdom Connect Phone Remote'
$OldRuleName = 'BSF Command Center iPad Remote'   # LEGACY (6.9): the same rule under the program's earlier name
Remove-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName $OldRuleName -ErrorAction SilentlyContinue
Write-Host ''
Write-Host '  The Kingdom Connect Phone Remote firewall rule has been removed.' -ForegroundColor Green
Write-Host '  (Your network type was not changed. Change it in Settings if you wish.)'
Write-Host ''
