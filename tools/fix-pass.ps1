# Sends the gate failures found by verify-worktree.ps1 back to an external agent in the same
# worktree, then waits for it and verifies again (run it in the background).
#   & tools\fix-pass.ps1 -Id chat-widget -Tool codex
#   & tools\fix-pass.ps1 -Id analytics -Tool opencode -Model opencode/deepseek-v4.1-flash-free
param(
  [Parameter(Mandatory)][string]$Id,
  [ValidateSet('codex', 'opencode')][string]$Tool = 'codex',
  [string]$Model = '',
  [string]$Notes = ''   # extra instructions for the agent, e.g. a failing behaviour to look at
)
$logs = 'D:\Sofa_Factory_wt\_logs'
$wt = "D:\Sofa_Factory_wt\$Id"
$fixFile = "$wt\web\docs\tasks\_fix-$Id.md"

function Section([string]$Title, [string[]]$Lines) {
  if (-not $Lines -or -not ($Lines -join '').Trim()) { return }
  "## $Title`n`n``````text`n$($Lines -join "`n")`n```````n"
}

$tsc = if (Test-Path "$logs\$Id.tsc.log") { @(Select-String -Path "$logs\$Id.tsc.log" -Pattern 'error TS' | Select-Object -First 40 | ForEach-Object { $_.Line }) }
$lint = if (Test-Path "$logs\$Id.lint.log") { @(Get-Content "$logs\$Id.lint.log" | Where-Object { $_ -notmatch '^\[gate\]' } | Select-Object -Last 60) }
$test = if (Test-Path "$logs\$Id.test.log") { @(Get-Content "$logs\$Id.test.log" | Where-Object { $_ -notmatch '^\[gate\]|Import  |isolate: false|learn more' } | Select-Object -First 110) }

$body = @"
# Fix pass: $Id

The integrator ran the gate (typecheck, eslint, vitest) on your work in this worktree. Fix every problem listed below, and the same mistake anywhere else in your own files. Edit only files you own according to web/docs/tasks/$Id.md. Do not change contracts, do not commit. You may not be able to run Node in your sandbox: that is expected, so reason carefully about types and behaviour. Keep to the house style (one statement per line, lines under 120 characters). When a test fails, decide whether the test or the code is wrong; if a test encodes a wrong assumption, fix the test.

$Notes

"@
$body += Section 'TypeScript errors' $tsc
$body += Section 'ESLint (the gate allows zero warnings)' $lint
$body += Section 'Vitest output' $test
Set-Content -Path $fixFile -Value $body -Encoding utf8

$instruction = "Read web/docs/tasks/_fix-$Id.md and web/docs/BUILD-GUIDE.md. Fix every problem listed in the fix file in this worktree. Do not commit."
& "$PSScriptRoot\launch-external.ps1" -Tool $Tool -Id $Id -Model $Model -Message $instruction
