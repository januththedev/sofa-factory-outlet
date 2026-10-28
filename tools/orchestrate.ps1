# Autopilot for the external coding agents. Reads tools\queue.json and, for each task: launches Codex or an
# OpenCode free model in its own worktree, waits for it, runs the gate on the result, sends failures back as a
# fix pass (at most -MaxAttempts runs per task), merges green work into main, then runs the whole gate on main
# and reverts the merge if main went red. Local only: nothing is ever pushed. Branches built by Claude
# (tool "claude") are merged once they have commits AND the file _logs\ready\<id> exists (create it when the
# subagent's report has arrived, so a half-finished branch is never merged).
# A gate step that dies of out-of-memory proves nothing about the code: it is retried later and costs no run.
#   Start-Process powershell -ArgumentList '-NoProfile','-File','D:\Sofa_Factory\tools\orchestrate.ps1' -WindowStyle Hidden
#   & tools\orchestrate.ps1 -DryRun            print what it would do, change nothing
#   New-Item D:\Sofa_Factory_wt\_logs\STOP     ask a running orchestrator to stop after its current step
# State: D:\Sofa_Factory_wt\_logs\state.json   Log: orchestrator.log   Summary when done: summary.md
param(
  [switch]$DryRun,
  [int]$MaxCodex = 3,
  [int]$MaxOpenCode = 2,
  [int]$MaxAttempts = 3,
  [int]$MaxGateRetries = 12,
  [int]$GateRetryMinutes = 5,
  [int]$PollSeconds = 60
)

$env:Path = 'C:\Users\janut\AppData\Local\Programs\node-portable;' + $env:Path
$repo = 'D:\Sofa_Factory'
$logs = 'D:\Sofa_Factory_wt\_logs'
$stateFile = "$logs\state.json"
$logFile = "$logs\orchestrator.log"
$pidFile = "$logs\orchestrator.pid"
New-Item -ItemType Directory -Force -Path $logs | Out-Null

# A gate step that dies with one of these says nothing about the code: the machine ran out of memory.
$oomPattern = 'out of memory|could not allocate memory|Zone Allocation failed|Committing semi space failed|insufficient system resources|memory allocation of \d+ bytes failed|std::bad_alloc'
# Free OpenCode models in the order they are tried; one that reports its free allowance used up is skipped.
$openCodeModels = @('opencode/mimo-v2.6-flash-free', 'opencode/glm-5.3-flash-free', 'opencode/nemotron-3-ultra-free', 'opencode/deepseek-v4.1-flash-free')
$openCodeDown = @{}

if ((Test-Path $pidFile) -and -not $DryRun) {
  $other = [int](Get-Content $pidFile)
  if ($other -ne $PID -and (Get-Process -Id $other -ErrorAction SilentlyContinue)) {
    Write-Host "Another orchestrator is running (pid $other)."
    exit 0
  }
}
if (-not $DryRun) { Set-Content -Path $pidFile -Value $PID }

function Log([string]$Message) {
  $line = '{0} {1}' -f (Get-Date -Format 'MM-dd HH:mm:ss'), $Message
  Add-Content -Path $logFile -Value $line
  Write-Host $line
}

function Invoke-Git([string[]]$Arguments) {
  $output = & git -C $repo @Arguments 2>&1
  [pscustomobject]@{ Code = $LASTEXITCODE; Text = (($output | ForEach-Object { "$_" }) -join "`n").Trim() }
}

function Load-State {
  $result = @{}
  if (Test-Path $stateFile) {
    $raw = Get-Content $stateFile -Raw | ConvertFrom-Json
    foreach ($entry in $raw.PSObject.Properties) {
      $item = @{}
      foreach ($field in $entry.Value.PSObject.Properties) { $item[$field.Name] = $field.Value }
      $result[$entry.Name] = $item
    }
  }
  $result
}

function Save-State {
  if (-not $DryRun) { $script:state | ConvertTo-Json -Depth 4 | Set-Content -Path $stateFile -Encoding utf8 }
}

function Test-Alive([string]$Id) {
  $file = "$logs\$Id.pid"
  if (-not (Test-Path $file)) { return $false }
  return [bool](Get-Process -Id ([int](Get-Content $file)) -ErrorAction SilentlyContinue)
}

# Commit headroom (GB): new agents crash at start-up when the machine is out of memory (2.5 GB is the bar for
# starting one; a merge only needs room for the gate, which copes with running out by itself).
function Test-Headroom([double]$Gb = 2.5) { ((Get-CimInstance Win32_OperatingSystem).FreeVirtualMemory / 1MB) -ge $Gb }

function Test-Ready($task) {
  foreach ($need in @($task.needs)) {
    if ($need -and (-not $script:state.ContainsKey($need) -or $script:state[$need].status -ne 'merged')) { return $false }
  }
  return $true
}

function Test-DependencyFailed($task) {
  foreach ($need in @($task.needs)) {
    if ($need -and $script:state.ContainsKey($need) -and @('failed', 'blocked') -contains $script:state[$need].status) { return $true }
  }
  return $false
}

function Start-Agent([string]$Id, [string]$Message = '') {
  $entry = $script:state[$Id]
  $arguments = @{ Tool = $entry.tool; Id = $Id }
  if ($entry.model) { $arguments.Model = $entry.model }
  if ($Message) { $arguments.Message = $Message }
  & "$PSScriptRoot\launch-external.ps1" @arguments | Out-Null
  Log "launched $Id with $($entry.tool), run $($entry.attempt)"
}

function Send-Fix([string]$Id) {
  $entry = $script:state[$Id]
  & "$PSScriptRoot\fix-pass.ps1" -Id $Id -Tool $entry.tool -Model $entry.model | Out-Null
  Log "fix pass launched for $Id with $($entry.tool), run $($entry.attempt)"
}

# Runs the gate on the worktree and reads the verdict out of verify-worktree.ps1's report. A step that died of
# out-of-memory proves nothing about the code, so a gate with only such failures is Inconclusive: it is run again
# later and costs the task no run (and no fix pass is sent for it).
function Test-Task([string]$Id, [bool]$AllowShared) {
  $text = (& "$PSScriptRoot\verify-worktree.ps1" -Id $Id | Out-String)
  $changed = 0
  $reported = $false
  if ($text -match 'changed files: (\d+)') {
    $changed = [int]$Matches[1]
    $reported = $true
  }
  $codes = @{ tsc = 1; lint = 0; test = 0 }
  $ran = @{}
  foreach ($name in @('tsc', 'lint', 'test')) {
    if ($text -match "--- $name exit (\d+)") {
      $codes[$name] = [int]$Matches[1]
      $ran[$name] = $true
    }
  }
  $forbidden = [bool]($text -match 'FORBIDDEN EDITS') -and -not $AllowShared
  # A report that never reached the typecheck (or never listed the files) means the verify script itself died.
  $starved = (-not $reported) -or (-not $ran['tsc'])
  $broken = ($reported -and $changed -eq 0) -or $forbidden
  foreach ($name in @('tsc', 'lint', 'test')) {
    if (-not $ran[$name] -or $codes[$name] -eq 0) { continue }
    $log = "$logs\$Id.$name.log"
    if ((Test-Path $log) -and (Select-String -Path $log -Pattern $oomPattern -Quiet)) { $starved = $true } else { $broken = $true }
  }
  $ok = ($changed -gt 0 -and $codes['tsc'] -eq 0 -and $codes['lint'] -eq 0 -and $codes['test'] -eq 0 -and -not $forbidden)
  [pscustomobject]@{
    Changed = $changed
    Ok = $ok
    Inconclusive = ((-not $ok) -and (-not $broken) -and $starved)
    Summary = "changed=$changed tsc=$($codes['tsc']) lint=$($codes['lint']) test=$($codes['test']) forbidden=$forbidden oom=$starved"
  }
}

# True when the last run ended on the tool's usage limit. Such a run is short (it failed at start-up), which keeps
# a long run that merely prints the word "quota" from a test or a source file from looking like one.
function Test-Exhausted([string]$Id) {
  $text = ''
  $bytes = 0
  foreach ($file in @("$logs\$Id.err", "$logs\$Id.out", "$logs\$Id.last.txt")) {
    if (Test-Path $file) {
      $bytes += (Get-Item $file).Length
      $text += (Get-Content $file -Tail 40 | Out-String)
    }
  }
  if ($bytes -gt 8192) { return $false }
  [bool]($text -match 'hit your usage limit|usage limit has been reached|usage limit reached|usage_limit_reached|insufficient_quota|exceeded your current quota|quota exceeded|credit balance')
}

# Empties the previous run's output so a quota message is acted on once, not on every poll.
function Reset-RunLogs([string]$Id) {
  foreach ($file in @("$logs\$Id.err", "$logs\$Id.out", "$logs\$Id.last.txt")) {
    if (Test-Path $file) { Clear-Content -Path $file -ErrorAction SilentlyContinue }
  }
}

# The first free OpenCode model that has not used up its allowance, or '' when none is left.
function Get-FreeModel {
  foreach ($model in $openCodeModels) {
    if (-not $openCodeDown[$model]) { return $model }
  }
  return ''
}

function Invoke-Check([string]$Dir, [string]$Tag, [string]$Name, [string]$Arguments) {
  $log = "$logs\$Tag.$Name.log"
  $bat = "$logs\$Tag.$Name.cmd"
  Set-Content -Path $bat -Encoding ascii -Value "@echo off`r`ncd /d `"$Dir`"`r`nnode scripts\check.mjs $Arguments > `"$log`" 2>&1`r`nexit /b %ERRORLEVEL%"
  cmd /c $bat | Out-Null
  $code = $LASTEXITCODE
  $code
}

# The whole gate on main. Returns '' when green, otherwise which step failed. A genuine failure is retried once
# (flaky tests); a step that dies of out-of-memory waits and tries again, and when it still cannot run the
# answer is "out of memory in <step>", which is not a verdict on the code.
function Test-Main([string]$Tag) {
  foreach ($name in @('tsc', 'lint', 'test')) {
    $starvedRuns = 0
    $failedRuns = 0
    while ($true) {
      $code = Invoke-Check "$repo\web" $Tag $name $name
      if ($code -eq 0) { break }
      $logText = if (Test-Path "$logs\$Tag.$name.log") { Get-Content "$logs\$Tag.$name.log" -Raw } else { '' }
      if ($logText -match $oomPattern) {
        $starvedRuns++
        if ($starvedRuns -ge 3) { return "out of memory in $name" }
        Log "main gate: $name ran out of memory, waiting 90 seconds"
        Start-Sleep -Seconds 90
      } else {
        $failedRuns++
        if ($failedRuns -ge 2) { return "$name exit $code" }
        Log "main gate: $name failed (exit $code), retrying once"
      }
    }
  }
  return ''
}

function Merge-Task($task) {
  $id = $task.id
  if ((Invoke-Git @('status', '--porcelain', '--untracked-files=no')).Text -ne '') {
    Log "main has uncommitted tracked changes, will try to merge $id again later"
    return 'retry'
  }
  $before = (Invoke-Git @('rev-parse', 'HEAD')).Text
  if ($task.tool -eq 'claude') {
    $result = Invoke-Git @('merge', '--no-ff', '-q', $task.branch, '-m', "Merge $id")
  } else {
    & "$PSScriptRoot\merge-worktree.ps1" -Id $id -Writer $task.writer -Message $task.message | Out-Null
    $result = Invoke-Git @('merge-base', '--is-ancestor', "wt/$id", 'HEAD')
  }
  $conflicts = (Invoke-Git @('diff', '--name-only', '--diff-filter=U')).Text
  if ($conflicts) {
    Invoke-Git @('merge', '--abort') | Out-Null
    Log "merge conflict in ${id}: $conflicts"
    return 'conflict'
  }
  if ($result.Code -ne 0) {
    Log "merge of $id did not complete: $($result.Text)"
    return 'conflict'
  }
  $mergeSha = (Invoke-Git @('rev-parse', 'HEAD')).Text
  $problem = Test-Main "main-$id"
  if ($problem -like 'out of memory*') {
    # Not the module's fault. Take the merge back out so that merging it again later is a real merge, not a no-op
    # (a reverted merge would be). --keep refuses to touch uncommitted changes, so nobody's edits are lost.
    if ((Invoke-Git @('rev-parse', 'HEAD')).Text -eq $mergeSha -and (Invoke-Git @('reset', '--keep', $before)).Code -eq 0) {
      Log "main gate ran out of memory after merging $id ($problem): merge taken back out, will retry"
      return 'oom'
    }
  }
  if ($problem) {
    $revert = Invoke-Git @('revert', '-m', '1', '--no-edit', 'HEAD')
    if ($revert.Code -ne 0) {
      Invoke-Git @('revert', '--abort') | Out-Null
      Log "CRITICAL: main is red after merging $id ($problem) and the revert failed: needs a person"
      $script:halt = $true
    } else {
      Log "main gate red after merging $id ($problem): merge reverted"
    }
    return 'red'
  }
  Log "merged $id at $((Invoke-Git @('rev-parse', '--short', 'HEAD')).Text), main gate green"
  return 'merged'
}

function Write-Summary {
  $lines = @('# Orchestrator summary', '', "Written $(Get-Date -Format 'yyyy-MM-dd HH:mm')", '', '| task | tool | status | runs | note |', '|---|---|---|---|---|')
  foreach ($task in $script:queue) {
    $entry = $script:state[$task.id]
    $lines += "| $($task.id) | $($entry.tool) | $($entry.status) | $($entry.attempt) | $($entry.note) |"
  }
  if (-not $DryRun) { Set-Content -Path "$logs\summary.md" -Value $lines -Encoding utf8 }
}

# ---- set-up -----------------------------------------------------------------------------------------------
# Windows PowerShell 5.1 hands a JSON array back as one object, so walk it explicitly.
$parsed = Get-Content "$PSScriptRoot\queue.json" -Raw | ConvertFrom-Json
$queue = @()
foreach ($item in $parsed) { $queue += $item }
$state = Load-State
$toolDown = @{ codex = $false; opencode = $false }
$halt = $false

foreach ($task in $queue) {
  if ($state.ContainsKey($task.id)) { continue }
  $entry = @{ status = 'queued'; attempt = 0; tool = [string]$task.tool; model = [string]$task.model; note = ''; since = (Get-Date).ToString('s') }
  if ($task.tool -eq 'claude') {
    $entry.status = 'waiting'
  } elseif (Test-Path "D:\Sofa_Factory_wt\$($task.id)\web") {
    # An agent was started before the orchestrator: adopt it.
    $entry.attempt = [Math]::Max(1, [int]$task.attempt)
    $entry.status = if (Test-Alive $task.id) { 'running' } else { 'finished' }
  }
  $state[$task.id] = $entry
}
Save-State
Log "orchestrator started (dry run: $DryRun)"

# ---- main loop --------------------------------------------------------------------------------------------
while ($true) {
  if (Test-Path "$logs\STOP") { Log 'STOP file found, leaving'; break }
  if ($halt) { Log 'halting after a critical error'; break }

  foreach ($task in $queue) {
    $id = $task.id
    $entry = $state[$id]
    if ($DryRun) { Log "DRY $id tool=$($entry.tool) status=$($entry.status)"; continue }

    switch ($entry.status) {
      'queued' {
        if (Test-DependencyFailed $task) {
          $entry.status = 'blocked'
          $entry.note = 'a dependency failed'
          Log "$id blocked: a dependency failed"
          break
        }
        if ($toolDown[$entry.tool]) {
          if ($entry.tool -eq 'codex') {
            $entry.tool = 'opencode'
            $entry.model = ''
            Log "codex is out of quota, $id moves to opencode"
          } else {
            break
          }
        }
        if ($entry.tool -eq 'opencode' -and (-not $entry.model -or $openCodeDown[$entry.model])) {
          $entry.model = Get-FreeModel
          if (-not $entry.model) {
            $toolDown['opencode'] = $true
            break
          }
        }
        $limit = if ($entry.tool -eq 'codex') { $MaxCodex } else { $MaxOpenCode }
        $running = @($state.Values | Where-Object { $_.status -eq 'running' -and $_.tool -eq $entry.tool }).Count
        if ((Test-Ready $task) -and $running -lt $limit -and (Test-Headroom)) {
          $entry.attempt = 1
          try {
            Start-Agent $id
            $entry.status = 'running'
            $entry.since = (Get-Date).ToString('s')
          } catch {
            $entry.status = 'failed'
            $entry.note = "launch failed: $_"
            Log "$id launch failed: $_"
          }
        }
      }
      'running' {
        if (-not (Test-Alive $id)) { $entry.status = 'finished'; Log "$id agent exited" }
      }
      'waiting' {
        $count = 0
        [void][int]::TryParse((Invoke-Git @('rev-list', '--count', "main..$($task.branch)")).Text, [ref]$count)
        if ($count -gt 0 -and (Test-Path "$logs\ready\$id")) {
          $entry.status = 'verified'
          Log "$id has $count commit(s) and its report is in, ready to merge"
        } elseif (((Get-Date) - [datetime]$entry.since).TotalHours -gt 6) {
          $entry.status = 'blocked'
          $entry.note = 'no commit after 6 hours'
        }
      }
      'finished' {
        if ($entry.gateAfter -and (Get-Date) -lt [datetime]$entry.gateAfter) { break }
        if (Test-Exhausted $id) {
          # The run ended on a usage limit, so it did nothing: it costs the task no run, and the task moves on.
          $entry.attempt = [Math]::Max(1, [int]$entry.attempt - 1)
          Reset-RunLogs $id
          if ($entry.tool -eq 'codex') {
            $toolDown['codex'] = $true
            $entry.tool = 'opencode'
            $entry.model = ''
            Log "codex looks out of quota, $id moves to opencode"
          } else {
            $openCodeDown[$entry.model] = $true
            Log "$($entry.model) has used up its free allowance"
          }
          $entry.model = Get-FreeModel
          if (-not $entry.model) {
            $toolDown['opencode'] = $true
            $entry.status = 'blocked'
            $entry.note = 'every free OpenCode model has used up its allowance'
            Log "$id blocked: $($entry.note)"
            break
          }
          Log "$id continues on $($entry.model)"
        }
        $verdict = Test-Task $id ([bool]$task.allowShared)
        $entry.note = $verdict.Summary
        if ($verdict.Ok) {
          $entry.status = 'verified'
          $entry.envRetries = 0
          Log "$id passed the gate ($($verdict.Summary))"
        } elseif ($verdict.Inconclusive) {
          $entry.envRetries = [int]$entry.envRetries + 1
          if ($entry.envRetries -ge $MaxGateRetries) {
            $entry.status = 'blocked'
            $entry.note = "the gate kept running out of memory ($($entry.envRetries) times); free memory, then remove this task from state.json to run it again"
            Log "$id blocked: $($entry.note)"
          } else {
            $entry.gateAfter = (Get-Date).AddMinutes($GateRetryMinutes).ToString('s')
            Log "$id gate ran out of memory ($($entry.envRetries) of $MaxGateRetries), trying again after $GateRetryMinutes minutes"
          }
        } elseif ($entry.attempt -ge $MaxAttempts) {
          $entry.status = 'failed'
          Log "$id still failing after $($entry.attempt) runs ($($verdict.Summary))"
        } elseif (-not (Test-Headroom)) {
          # An agent started on a machine with no memory left just crashes and wastes a run.
          $entry.gateAfter = (Get-Date).AddMinutes(10).ToString('s')
          Log "$id needs another run but the machine is out of memory, waiting 10 minutes"
        } else {
          $entry.envRetries = 0
          $entry.attempt = [int]$entry.attempt + 1
          try {
            if ($verdict.Changed -eq 0) { Start-Agent $id } else { Send-Fix $id }
            $entry.status = 'running'
          } catch {
            $entry.status = 'failed'
            $entry.note = "relaunch failed: $_"
            Log "$id relaunch failed: $_"
          }
        }
      }
      'verified' {
        if ($entry.gateAfter -and (Get-Date) -lt [datetime]$entry.gateAfter) { break }
        if (-not (Test-Headroom 1.0)) { break }
        $outcome = Merge-Task $task
        if ($outcome -eq 'merged') { $entry.status = 'merged' }
        elseif ($outcome -eq 'conflict') { $entry.status = 'blocked'; $entry.note = 'merge conflict' }
        elseif ($outcome -eq 'red') { $entry.status = 'blocked'; $entry.note = 'main went red after the merge; merge reverted' }
        elseif ($outcome -eq 'oom') {
          $entry.envRetries = [int]$entry.envRetries + 1
          if ($entry.envRetries -ge $MaxGateRetries) {
            $entry.status = 'blocked'
            $entry.note = 'the main gate kept running out of memory; free memory, then set the status back to verified'
          } else {
            $entry.gateAfter = (Get-Date).AddMinutes($GateRetryMinutes).ToString('s')
          }
        }
      }
    }
    Save-State
    if ($halt -or (Test-Path "$logs\STOP")) { break }
  }

  if ($DryRun) { break }

  $active = @($state.Values | Where-Object { @('running', 'waiting', 'finished', 'verified') -contains $_.status })
  $queued = @($queue | Where-Object { $state[$_.id].status -eq 'queued' })
  if ($active.Count -eq 0) {
    $launchable = @($queued | Where-Object { (Test-Ready $_) -and -not ($toolDown[$state[$_.id].tool] -and $state[$_.id].tool -eq 'opencode') })
    if ($launchable.Count -eq 0) {
      foreach ($task in $queued) {
        $state[$task.id].status = 'blocked'
        $state[$task.id].note = 'not launchable (dependency or tool limit)'
      }
      Save-State
      Log 'queue finished'
      break
    }
  }
  Start-Sleep -Seconds $PollSeconds
}

Save-State
Write-Summary
Log 'orchestrator stopped'
