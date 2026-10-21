# FrameDecks - remove the phone remote firewall permission.
$RuleName = 'FrameDecks Phone Remote'
$OldRuleNames = @('Kingdom Connect Phone Remote', 'BSF Command Center iPad Remote')   # LEGACY: the same rule under the program's earlier names
Remove-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
foreach ($n in $OldRuleNames) { Remove-NetFirewallRule -DisplayName $n -ErrorAction SilentlyContinue }
Write-Host ''
Write-Host '  The FrameDecks Phone Remote firewall rule has been removed.' -ForegroundColor Green
Write-Host '  (Your network type was not changed. Change it in Settings if you wish.)'
Write-Host ''
