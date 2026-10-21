# FRAMEDECKS - allow the iPad remote through Windows Firewall.
# Run by "Allow iPad Remote (run once).bat" (as administrator).
# Every change is limited to PRIVATE networks and can be undone with
# "Undo iPad Remote permission.bat".

$ErrorActionPreference = 'Continue'
$LogFile = Join-Path (Split-Path -Parent $PSScriptRoot) 'ipad-remote-check.txt'
try { Start-Transcript -Path $LogFile -Force | Out-Null } catch { }
$RuleName = 'Kingdom Connect Phone Remote'
$OldRuleName = 'BSF Command Center iPad Remote'   # LEGACY (6.9): replaced by the rule above
$Ports = '8750-8760'

function Say($text, $color) { if ($color) { Write-Host $text -ForegroundColor $color } else { Write-Host $text } }
function Step($n, $text) { Write-Host ''; Write-Host ("[" + $n + "] " + $text) -ForegroundColor Cyan }

Say ''
Say '  FRAMEDECKS - allow the iPad remote' Yellow
Say '  ------------------------------------------'

# 1. Network type -------------------------------------------------------------
Step 1 'Checking your network type'
$profiles = @(Get-NetConnectionProfile -ErrorAction SilentlyContinue)
if ($profiles.Count -eq 0) {
    Say '    No network connection found. Connect this PC to your Wi-Fi and run this again.' Red
}
foreach ($p in $profiles) {
    Say ('    ' + $p.InterfaceAlias + ' - network "' + $p.Name + '" is set to: ' + $p.NetworkCategory)
    if ($p.NetworkCategory -eq 'Public') {
        Say '    Windows blocks other devices on Public networks.' Yellow
        $answer = Read-Host ('    Is "' + $p.Name + '" your own home or church Wi-Fi, and should it be set to Private? (Y/N)')
        if ($answer -match '^[Yy]') {
            try {
                Set-NetConnectionProfile -InterfaceIndex $p.InterfaceIndex -NetworkCategory Private -ErrorAction Stop
                Say '    Changed to Private.' Green
            } catch {
                Say ('    Could not change it: ' + $_.Exception.Message) Red
                Say '    Change it by hand: Settings > Network & internet > Wi-Fi > your network > Private.' Yellow
            }
        } else {
            Say '    Left as Public. The iPad remote will not work on this network.' Yellow
        }
    }
}

# 2. Hidden rules that block Python ---------------------------------------------
Step 2 'Looking for firewall rules that block Python on private networks'
$blockRules = @()
try {
    $blockRules = @(Get-NetFirewallApplicationFilter -All -ErrorAction Stop |
        Where-Object { $_.Program -match 'python' } |
        Get-NetFirewallRule -ErrorAction SilentlyContinue |
        Where-Object { $_.Direction -eq 'Inbound' -and $_.Action -eq 'Block' -and $_.Enabled -eq 'True' -and ([string]$_.Profile) -match 'Private|Any' })
} catch { }
if ($blockRules.Count -eq 0) {
    Say '    None found.' Green
} else {
    foreach ($r in $blockRules) {
        Disable-NetFirewallRule -Name $r.Name -ErrorAction SilentlyContinue
        Say ('    Turned off block rule: "' + $r.DisplayName + '" (' + $r.Profile + ')') Green
    }
    Say '    (These were created when a firewall question about Python was cancelled.)'
}

# 3. Allow the Command Center's ports on private networks -----------------------
Step 3 ('Allowing the Command Center (TCP ports ' + $Ports + ') on private networks')
Remove-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName $OldRuleName -ErrorAction SilentlyContinue
try {
    New-NetFirewallRule -DisplayName $RuleName -Description 'Lets an iPad or phone on your own Wi-Fi reach the FRAMEDECKS remote.' `
        -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Ports -Profile Private,Domain -ErrorAction Stop | Out-Null
    Say '    Done.' Green
} catch {
    Say ('    Could not add the rule: ' + $_.Exception.Message) Red
}

# 4. Is the Command Center running in remote mode? ------------------------------
Step 4 'Checking the Command Center program'
$listen = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -ge 8750 -and $_.LocalPort -le 8760 })
if ($listen.Count -eq 0) {
    Say '    It is not running right now. Start "Start Kingdom Connect with iPad Remote.bat" after this.' Yellow
} elseif (@($listen | Where-Object { $_.LocalAddress -eq '0.0.0.0' -or $_.LocalAddress -eq '::' }).Count -gt 0) {
    Say ('    Running in iPad remote mode on port ' + $listen[0].LocalPort + '.') Green
} else {
    Say '    It is running in NORMAL mode (PC only). Close its black window and start' Yellow
    Say '    "Start Kingdom Connect with iPad Remote.bat" instead.' Yellow
}

# 5. Other security software -----------------------------------------------------
Step 5 'Checking for other security software'
$others = @()
try { $others = @(Get-CimInstance -Namespace root/SecurityCenter2 -ClassName FirewallProduct -ErrorAction Stop | Where-Object { $_.displayName -notmatch 'Windows' }) } catch { }
if ($others.Count -eq 0) {
    Say '    Only Windows Firewall is in use.' Green
} else {
    foreach ($o in $others) {
        Say ('    Found: ' + $o.displayName) Yellow
    }
    Say '    This program has its OWN firewall, which Windows settings do not control.' Yellow
    Say '    Open it and allow "Python" (or TCP port 8750) on your home network.' Yellow
}

# 6. Addresses for the iPad ------------------------------------------------------
Step 6 'Addresses to open on the iPad'
$ips = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' })
foreach ($ip in $ips) {
    Say ('    http://' + $ip.IPAddress + ':8750/remote.html      (' + $ip.InterfaceAlias + ')')
}
Say '    Use the one on your Wi-Fi (or Ethernet) connection.'

Say ''
Say '  Finished. Now try the iPad again.' Yellow
Say '  In the Command Center black window, a line "Connection from ..." appears'
Say '  when the iPad gets through. If no such line appears, see the README'
Say '  section "If the iPad can''t connect" (the router may be blocking it).'
Say ''
try { Stop-Transcript | Out-Null } catch { }
