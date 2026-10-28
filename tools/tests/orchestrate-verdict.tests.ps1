# Tests the verdict logic of tools\orchestrate.ps1 by extracting the real functions with the AST (the loop never runs).
#   & tools\tests\orchestrate-verdict.tests.ps1
# verify-worktree.ps1 next to this file is a stub that prints a canned report; logs go to the temp folder.
$scratch = $PSScriptRoot
$work = Join-Path ([IO.Path]::GetTempPath()) 'orchestrate-verdict-tests'
New-Item -ItemType Directory -Force -Path $work | Out-Null
$src = Join-Path $PSScriptRoot '..\orchestrate.ps1'
$errs = $null; $tokens = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($src, [ref]$tokens, [ref]$errs)
$funcs = $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] }, $true)
foreach ($name in 'Test-Task', 'Test-Exhausted', 'Reset-RunLogs', 'Get-FreeModel') {
  $f = $funcs | Where-Object { $_.Name -eq $name }
  if (-not $f) { throw "function $name not found" }
  # A function made with Invoke-Expression has no $PSScriptRoot: point it at the stub verify script instead.
  Invoke-Expression $f.Extent.Text.Replace('$PSScriptRoot', $scratch)
}
# The same constants the script defines (read from the script so a drift is caught).
foreach ($assign in $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.AssignmentStatementAst] }, $false)) {
  $left = $assign.Left.Extent.Text
  if ($left -in '$oomPattern', '$openCodeModels') { Invoke-Expression $assign.Extent.Text }
}
$openCodeDown = @{}
$logs = Join-Path $work 'logs'
Remove-Item $logs -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $logs | Out-Null

$script:fail = 0
function Check([string]$Name, [bool]$Condition) {
  if ($Condition) { "  ok    $Name" } else { "  FAIL  $Name"; $script:fail++ }
}
function Scenario([string]$Report, [hashtable]$LogTexts = @{}) {
  Get-ChildItem $logs -Filter 't.*' -ErrorAction SilentlyContinue | Remove-Item -Force
  Set-Content -Path "$work\report.txt" -Value $Report -Encoding utf8
  $env:SCENARIO_REPORT = "$work\report.txt"
  foreach ($k in $LogTexts.Keys) { Set-Content -Path "$logs\t.$k.log" -Value $LogTexts[$k] -Encoding utf8 }
  Test-Task 't' $false
}
$oomText = "FATAL ERROR: Zone Allocation failed - process out of memory`n----- Native stack trace -----"
$lintReal = "src/x.tsx`n  57:18  warning  Compilation Skipped: Use of incompatible library`n1 problem (0 errors, 1 warning)"

'Test-Task'
$v = Scenario "=== t`n--- changed files: 5`n--- tsc exit 0`n--- lint exit 0`n--- test exit 0"
Check 'all green is Ok' ($v.Ok -and -not $v.Inconclusive)

$v = Scenario "--- changed files: 18`n--- tsc exit 134`n--- lint exit 1`n--- test exit 1" @{ tsc = $oomText; lint = $lintReal; test = $oomText }
Check 'tsc+test OOM but a REAL lint warning is a conclusive failure' (-not $v.Ok -and -not $v.Inconclusive)

$v = Scenario "--- changed files: 14`n--- tsc exit 0`n--- lint exit 0`n--- test exit 1" @{ test = "RangeError: WebAssembly.Memory(): could not allocate memory" }
Check 'PGlite could not allocate memory is Inconclusive' ((-not $v.Ok) -and $v.Inconclusive)

$v = Scenario "--- changed files: 23`n--- tsc exit 0`n--- lint exit 0`n--- test exit 134" @{ test = $oomText }
Check 'Zone OOM in vitest is Inconclusive' ((-not $v.Ok) -and $v.Inconclusive)

$v = Scenario "--- changed files: 27`n--- tsc exit 0`n--- lint exit 0`n--- test exit 1" @{ test = "AssertionError: expected 2 to be 3`n FAIL tests/unit/x.test.ts" }
Check 'a real assertion failure is conclusive' (-not $v.Ok -and -not $v.Inconclusive)

$v = Scenario "--- changed files: 6`n--- tsc exit 0`n--- lint exit 0`n--- test exit 0`n--- FORBIDDEN EDITS`n  package.json"
Check 'forbidden edits are conclusive' (-not $v.Ok -and -not $v.Inconclusive)

$v = Scenario "--- changed files: 0`n--- tsc exit 134" @{ tsc = $oomText }
Check 'nothing changed is conclusive even if tsc starved (agent did nothing)' (-not $v.Ok -and -not $v.Inconclusive)

$v = Scenario ''
Check 'an empty report (verify script died) is Inconclusive, not "agent did nothing"' (-not $v.Ok -and $v.Inconclusive)

$v = Scenario "--- changed files: 9`n--- tsc exit 0`n--- lint exit 0"
Check 'no tests changed (no test exit line) with tsc+lint 0 is Ok' ($v.Ok)

$v = Scenario "--- changed files: 9`n--- tsc exit 1" @{ tsc = "src/a.ts(3,1): error TS2322: bad" }
Check 'a real type error is conclusive' (-not $v.Ok -and -not $v.Inconclusive)

'Test-Exhausted'
function Seed([string]$Err, [string]$Out = '') { Set-Content "$logs\q.err" $Err -Encoding utf8; Set-Content "$logs\q.out" $Out -Encoding utf8; Remove-Item "$logs\q.last.txt" -ErrorAction SilentlyContinue }
Seed "> build - deepseek-v4.1-flash-free`nError: Free usage limit reached. Connect a provider or subscribe to OpenCode Go to keep going, or switch models."
Check 'OpenCode "Free usage limit reached" is detected' (Test-Exhausted 'q')
Seed "You've hit your usage limit. Try again later."
Check 'Codex "hit your usage limit" is detected' (Test-Exhausted 'q')
Seed ("x" * 20000 + "`nthrow new Error('quota exceeded')`n")
Check 'a long normal run that prints "quota exceeded" in code is NOT a quota failure' (-not (Test-Exhausted 'q'))
Seed "all good`ndone"
Check 'a clean short run is not a quota failure' (-not (Test-Exhausted 'q'))
Seed "Free usage limit reached"
Reset-RunLogs 'q'
Check 'Reset-RunLogs clears the evidence so it is acted on once' (-not (Test-Exhausted 'q'))

'Get-FreeModel'
$openCodeDown = @{}
Check 'first model is mimo' ((Get-FreeModel) -eq 'opencode/mimo-v2.6-flash-free')
$openCodeDown['opencode/mimo-v2.6-flash-free'] = $true
Check 'skips a used-up model' ((Get-FreeModel) -eq 'opencode/glm-5.3-flash-free')
foreach ($m in $openCodeModels) { $openCodeDown[$m] = $true }
Check 'returns empty when every model is used up' ((Get-FreeModel) -eq '')

if ($script:fail) { "`n$script:fail FAILED"; exit 1 } else { "`nall passed" }
