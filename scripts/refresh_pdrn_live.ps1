<#
  Dashboard bookings refresh on server .28:
      SAP PRD (ZSD_PDRN) --13:00/17:00--> SQL PDRN.dbo.SAP_PDRN   (VendorGlobe API, app/pdrn_sync.py)
      SAP PRD (ZSD_INVR) --13:00/17:00--> SQL PDRN.dbo.SAP_INVR   (same API, once VG_INVR_ENABLED=1)
      SAP PRD (ZREC_PRINT, ZALR, ZSD_DAPP) --13:00/17:00--> SQL SAP_ZREC, SAP_ZALR_NP/_PJ, SAP_ZDAPP
      SQL --this script, every 10 min 13:10-19:10--> dashboard data + npm run build
          (invr_from_sap.py, pdrn_from_sap.py, zrec_from_sap.py, cost_from_sap.py, dapp_from_sap.py)
  The dashboard is rebuilt only when SQL holds a NEW load, so the extra checks cost nothing.
  The SAP login lives in C:\VendorGlobe_API\pdrn.env (API side), not here.

  One-time setup (admin PowerShell, in the dashboard folder):
    .\scripts\refresh_pdrn_live.ps1 -Test        # read SQL via the API + check, changes nothing
    .\scripts\refresh_pdrn_live.ps1              # first refresh + build
    .\scripts\refresh_pdrn_live.ps1 -Install     # schedule it

  Deploying new code from now on (instead of plain "git pull"):
    .\scripts\refresh_pdrn_live.ps1 -Pull        # reset data files, git pull, refresh, build

  If the API / SQL is unavailable or the data looks wrong, nothing changes: the dashboard keeps its
  last data and the reason is written to logs\pdrn_refresh.log.
#>
param(
    [switch]$SetCredentials,
    [switch]$Install,
    [switch]$Uninstall,
    [switch]$Test,
    [switch]$Pull,
    [string]$Python = "C:\VendorGlobe_API\python312\python.exe",
    [string]$Npm = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $Root "logs"
$Log = Join-Path $LogDir "pdrn_refresh.log"
$Lock = Join-Path $LogDir "pdrn_refresh.lock"
$TaskName = "Dashboard PDRN refresh"
$OldTaskNames = @("Dashboard PDRN refresh 1PM", "Dashboard PDRN refresh 5PM")
# files the refresh rewrites (git sees them as changed between deploys)
$DataFiles = @("src/data/cpAnalytics.json", "src/data/smartworldInventory.json",
               "src/data/tvAnalytics.json", "src/data/collections.json", "src/data/eoiData.json",
               "src/data/costProject.json", "src/data/costNonProject.json", "src/data/dappData.json",
               "src/config/dataInfo.ts")

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
# Python prints Rs / curly-quote project names; make it UTF-8 on Windows (also for file reads)
$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"
# read Python/npm output as UTF-8 so the rupee sign and curly quotes show correctly in the window and log
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }
$OutputEncoding = [System.Text.Encoding]::UTF8

# run a program, return its output lines + exit code (stderr warnings must not stop the script)
function Invoke-Native([string]$exe, [string[]]$argList) {
    $old = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try { $o = & $exe @argList 2>&1 | ForEach-Object { "$_" } } finally { $ErrorActionPreference = $old }
    return @{ Out = $o; Code = $LASTEXITCODE }
}
function Log($msg) {
    $line = "{0:yyyy-MM-dd HH:mm:ss}  {1}" -f (Get-Date), $msg
    Write-Host $line
    Add-Content -Path $Log -Value $line -Encoding UTF8
}

# ---------------- one-time: SAP user / password as machine environment variables ----------------
if ($SetCredentials) {
    $u = Read-Host "SAP Production user for the dashboard (e.g. ZPDRN_WEB)"
    $p = Read-Host "Password for $u" -AsSecureString
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($p))
    [Environment]::SetEnvironmentVariable("VG_PDRN_USER", $u, "Machine")
    [Environment]::SetEnvironmentVariable("VG_PDRN_PASSWORD", $plain, "Machine")
    Write-Host "Saved VG_PDRN_USER / VG_PDRN_PASSWORD for this machine. Close and reopen PowerShell before -Test."
    exit 0
}

# ---------------- schedule: 1:00 PM and 5:00 PM every day ----------------
if ($Uninstall) {
    foreach ($t in @($TaskName) + $OldTaskNames) { Unregister-ScheduledTask -TaskName $t -Confirm:$false -ErrorAction SilentlyContinue }
    Write-Host "Scheduled refreshes removed."
    exit 0
}
if ($Install) {
    if (-not $Npm) { $Npm = (Get-Command npm.cmd -ErrorAction Stop).Source }
    if (-not (Test-Path $Python)) { throw "Python not found at $Python (use -Python <path>)" }
    $taskArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Python `"$Python`" -Npm `"$Npm`""
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $taskArgs -WorkingDirectory $Root
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
                -MultipleInstances IgnoreNew
    foreach ($t in $OldTaskNames) { Unregister-ScheduledTask -TaskName $t -Confirm:$false -ErrorAction SilentlyContinue }
    # daily 13:10, then every 10 minutes for 6 hours (covers the 13:00 and 17:00 SQL loads)
    $trigger = New-ScheduledTaskTrigger -Daily -At "13:10"
    $rep = New-ScheduledTaskTrigger -Once -At "13:10" -RepetitionInterval (New-TimeSpan -Minutes 10) `
           -RepetitionDuration (New-TimeSpan -Hours 6)
    $trigger.Repetition = $rep.Repetition
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
        -Principal $principal -Settings $settings -Force | Out-Null
    Write-Host "Scheduled '$TaskName': daily 13:10-19:10 every 10 min, rebuilds only on a new SQL load (runs as SYSTEM)."
    Write-Host "npm: $Npm    python: $Python    log: $Log"
    exit 0
}

# ---------------- the refresh itself ----------------
if (Test-Path $Lock) {
    $age = (Get-Date) - (Get-Item $Lock).LastWriteTime
    if ($age.TotalHours -lt 2) { Log "another refresh is still running - skipped"; exit 0 }
}
Set-Content -Path $Lock -Value $PID
try {
    Set-Location $Root
    if (-not (Test-Path $Python)) { throw "Python not found at $Python" }
    if (-not $Npm) { $Npm = (Get-Command npm.cmd -ErrorAction Stop).Source }

    if ($Pull) {
        Log "deploy: resetting data files and pulling new code"
        $g = Invoke-Native "git" (@("checkout", "--") + $DataFiles)
        $g = Invoke-Native "git" @("pull")
        $g.Out | ForEach-Object { Log "  $_" }
        if ($g.Code -ne 0) { throw "git pull failed" }
    }

    # INVR (inventory) first, then PDRN (bookings): build_tva.py, run by both, makes the inventory
    # booking status follow the PDRN, so the PDRN step must see the newest inventory.
    # ZREC (Collections + EOI) after PDRN: Collections links receipts to the PDRN bookings.
    $flags = @()
    if ($Test) { $flags += "--check" }
    if ($Pull) { $flags += "--force" }   # data files were reset - rebuild from SQL even if same load
    Log ("SAP refresh started" + $(if ($Test) { " (test only)" } else { "" }))
    $codes = @{}
    $steps = @(@("INVR", "scripts/invr_from_sap.py"), @("PDRN", "scripts/pdrn_from_sap.py"),
               @("ZREC", "scripts/zrec_from_sap.py"), @("COST", "scripts/cost_from_sap.py"),
               @("DAPP", "scripts/dapp_from_sap.py"))
    foreach ($step in $steps) {
        Log "$($step[0]):"
        $r = Invoke-Native $Python (@($step[1]) + $flags)
        $r.Out | ForEach-Object { Log "  $_" }
        $codes[$step[0]] = $r.Code
    }
    $code = $codes["PDRN"]
    $summary = (($steps | ForEach-Object { "$($_[0]) $($codes[$_[0]])" }) -join ", ") + " (0 = new data, 3 = nothing new, 1 = failed)"

    if ($Test) { Log "test finished - $summary - nothing changed"; exit $code }

    $newData = ($codes.Values | Where-Object { $_ -eq 0 }).Count -gt 0
    $failed = ($codes.Values | Where-Object { $_ -ne 0 -and $_ -ne 3 }).Count -gt 0
    if (-not $newData -and -not $Pull) {
        if ($failed) { Log "$summary - dashboard keeps its last data, no rebuild"; exit 1 }
        exit 0                                       # same SQL loads already on the dashboard
    }
    if ($failed) { Log "$summary - building with what did refresh; the failed part keeps its last data" }

    Log "building dashboard (npm run build)"
    $b = Invoke-Native $Npm @("run", "build")
    $bcode = $b.Code
    $b.Out | Select-Object -Last 15 | ForEach-Object { Log "  $_" }
    if ($bcode -ne 0) { throw "npm run build failed - the previous build is still being served" }
    if (-not $failed) { Log "done - dashboard rebuilt with live SAP data ($summary)" }
    else { Log "done - dashboard rebuilt ($summary; see above)" }
}
catch {
    Log "ERROR: $($_.Exception.Message)"
    exit 1
}
finally {
    Remove-Item -Path $Lock -ErrorAction SilentlyContinue
    # keep the log small
    if ((Test-Path $Log) -and (Get-Item $Log).Length -gt 2MB) {
        Get-Content $Log -Tail 2000 | Set-Content "$Log.tmp"; Move-Item "$Log.tmp" $Log -Force
    }
}
