# Waits for an external agent to exit (optional), then runs the gate on its worktree
# and prints a compact verdict: report, changed files, forbidden edits, tsc, lint, tests.
#   & tools\verify-worktree.ps1 -Id store-listing -Wait
param(
  [Parameter(Mandatory)][string]$Id,
  [switch]$Wait
)
$env:Path = 'C:\Users\janut\AppData\Local\Programs\node-portable;' + $env:Path
$logs = 'D:\Sofa_Factory_wt\_logs'
$wt = "D:\Sofa_Factory_wt\$Id"

if ($Wait) {
  $pidFile = "$logs\$Id.pid"
  if (Test-Path $pidFile) { Wait-Process -Id ([int](Get-Content $pidFile)) -ErrorAction SilentlyContinue }
}

"=== $Id finished $(Get-Date -Format 'HH:mm:ss')"
$last = "$logs\$Id.last.txt"
if (Test-Path $last) { '--- agent report'; Get-Content $last -TotalCount 40 }
elseif (Test-Path "$logs\$Id.out") { '--- agent output (tail)'; Get-Content "$logs\$Id.out" -Tail 25 }

$changed = @(git -C $wt status --porcelain --untracked-files=all |
  ForEach-Object { $_.Substring(3).Trim('"') } |
  Where-Object { $_ -like 'web/*' -and $_ -notlike 'web/node_modules*' } |
  ForEach-Object { $_.Substring(4) })
"--- changed files: $($changed.Count)"
$changed | ForEach-Object { "  $_" }

$forbidden = '^(package\.json|package-lock\.json|next\.config\.ts|src/app/globals\.css|src/app/layout\.tsx|src/app/\(site\)/(layout|page)\.tsx|src/lib/db/schema/|drizzle/|src/lib/settings/|src/components/(site|landing|ui)/|\.env)'
$bad = @($changed | Where-Object { $_ -match $forbidden })
if ($bad.Count) { '--- FORBIDDEN EDITS'; $bad | ForEach-Object { "  $_" } }

function Invoke-Check([string]$Name, [string]$Arguments) {
  $log = "$logs\$Id.$Name.log"
  $bat = "$logs\$Id.$Name.cmd"
  Set-Content -Path $bat -Encoding ascii -Value "@echo off`r`ncd /d `"$wt\web`"`r`nnode scripts\check.mjs $Arguments > `"$log`" 2>&1`r`nexit /b %ERRORLEVEL%"
  cmd /c $bat
  return [pscustomobject]@{ Code = $LASTEXITCODE; Log = $log }
}

$quote = { param($items) ($items | ForEach-Object { '"' + $_ + '"' }) -join ' ' }
$code = @($changed | Where-Object { $_ -match '\.(ts|tsx|mjs)$' -and $_ -notmatch '^(content|seed)/.*\.json$' })
$tests = @($changed | Where-Object { $_ -match '^tests/(unit|db)/.*\.test\.ts$' })

$tsc = Invoke-Check 'tsc' 'tsc'
"--- tsc exit $($tsc.Code)"
Select-String -Path $tsc.Log -Pattern 'error TS' | Select-Object -First 40 | ForEach-Object { $_.Line }

if ($code.Count) {
  $lint = Invoke-Check 'lint' ('lint ' + (& $quote $code))
  "--- lint exit $($lint.Code)"
  if ($lint.Code -ne 0) { Get-Content $lint.Log -Tail 60 }
}
if ($tests.Count) {
  $test = Invoke-Check 'test' ('test ' + (& $quote $tests))
  "--- test exit $($test.Code)"
  Get-Content $test.Log -Tail 30
}
"=== $Id verified $(Get-Date -Format 'HH:mm:ss')"
