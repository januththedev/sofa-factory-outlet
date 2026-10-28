# Autopilot for the external coding agents. Reads tools\queue.json and, for each task: launches Codex or an
# OpenCode free model in its own worktree, waits for it, runs the gate on the result, sends failures back as a
# fix pass (at most -MaxAttempts runs per task), merges green work into main, then runs the whole gate on main
# and reverts the merge if main went red. Local only: nothing is ever pushed. Branches built by Claude
# (tool "claude") are merged as soon as they have commits.
#   Start-Process powershell -ArgumentList '-NoProfile','-File','D:\Sofa_Factory\tools\orchestrate.ps1' -WindowStyle Hidden
#   & tools\orchestrate.ps1 -DryRun            print what it would do, change nothing
#   New-Item D:\Sofa_Factory_wt\_logs\STOP     ask a running orchestrator to stop after its current step
# State: D:\Sofa_Factory_wt\_logs\state.json   Log: orchestrator.log   Summary when done: summary.md
param(
  [switch]$DryRun,
  [int]$MaxCodex = 3,
  [int]$MaxOpenCode = 2,
  [int]$MaxAttempts = 3,
  [int]$PollSeconds = 60
)

$env:Path = 'C:\Users\janut\AppData\Local\Programs\node-portable;' + $env:Path
$repo = 'D:\Sofa_Factory'
$logs = 'D:\Sofa_Factory_wt\_logs'
$stateFile = "$logs\state.json"
$logFile = "$logs\orchestrator.log"
$pidFile = "$logs\orchestrator.pid"
New-Item -ItemType Directory -Force -Path $logs | Out-Null

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

function Git([string[]]$Arguments) {
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

# Commit headroom (GB): new agents crash at start-up when the machine is out of memory.
function Test-Headroom { ((Get-CimInstance Win32_OperatingSystem).FreeVirtualMemory / 1MB) -ge 2.5 }

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

# Runs the gate on the worktree and reads the verdict out of verify-worktree.ps1's report.
function Test-Task([string]$Id, [bool]$AllowShared) {
  $text = (& "$PSScriptRoot\verify-worktree.ps1" -Id $Id | Out-String)
  $changed = 0
  $tsc = 1
  $lint = 0
  $test = 0
  if ($text -match 'changed files: (\d+)') { $changed = [int]$Matches[1] }
  if ($text -match '--- tsc exit (\d+)') { $tsc = [int]$Matches[1] }
  if ($text -match '--- lint exit (\d+)') { $lint = [int]$Matches[1] }
  if ($text -match '--- test exit (\d+)') { $test = [int]$Matches[1] }
  $forbidden = [bool]($text -match 'FORBIDDEN EDITS') -and -not $AllowShared
  [pscustomobject]@{
    Changed = $changed
    Ok = ($changed -gt 0 -and $tsc -eq 0 -and $lint -eq 0 -and $test -eq 0 -and -not $forbidden)
    Summary = "changed=$changed tsc=$tsc lint=$lint test=$test forbidden=$forbidden"
  }
}

# True when a run that changed nothing ended because the tool's quota is used up.
function Test-Exhausted([string]$Id) {
  $text = ''
  foreach ($file in @("$logs\$Id.err", "$logs\$Id.out", "$logs\$Id.last.txt")) {
    if (Test-Path $file) { $text += (Get-Content $file -Tail 40 | Out-String) }
  }
  [bool]($text -match 'hit your usage limit|usage limit has been reached|usage_limit_reached|insufficient_quota|exceeded your current quota|quota exceeded|credit balance')
}

function Invoke-Check([string]$Dir, [string]$Tag, [string]$Name, [string]$Arguments) {
  $log = "$logs\$Tag.$Name.log"
  $bat = "$logs\$Tag.$Name.cmd"
  Set-Content -Path $bat -Encoding ascii -Value "@echo off`r`ncd /d `"$Dir`"`r`nnode scripts\check.mjs $Arguments > `"$log`" 2>&1`r`nexit /b %ERRORLEVEL%"
  cmd /c $bat | Out-Null
  $code = $LASTEXITCODE
  $code
}

# The whole gate on main. Returns '' when green, otherwise which step failed. A failing step is retried once
# because out-of-memory crashes on this machine are not real failures.
function Test-Main([string]$Tag) {
  foreach ($name in @('tsc', 'lint', 'test')) {
    $code = Invoke-Check "$repo\web" $Tag $name $name
    if ($code -ne 0) {
      Log "main gate: $name failed (exit $code), retrying once"
      $code = Invoke-Check "$repo\web" $Tag $name $name
      if ($code -ne 0) { return "$name exit $code" }
    }
  }
  return ''
}

function Merge-Task($task) {
  $id = $task.id
  if ((Git @('status', '--porcelain', '--untracked-files=no')).Text -ne '') {
    Log "main has uncommitted tracked changes, will try to merge $id again later"
    return 'retry'
  }
  if ($task.tool -eq 'claude') {
    $result = Git @('merge', '--no-ff', '-q', $task.branch, '-m', "Merge $id")
  } else {
    & "$PSScriptRoot\merge-worktree.ps1" -Id $id -Writer $task.writer -Message $task.message | Out-Null
    $result = Git @('merge-base', '--is-ancestor', "wt/$id", 'HEAD')
  }
  $conflicts = (Git @('diff', '--name-only', '--diff-filter=U')).Text
  if ($conflicts) {
    Git @('merge', '--abort') | Out-Null
    Log "merge conflict in ${id}: $conflicts"
    return 'conflict'
  }
  if ($result.Code -ne 0) {
    Log "merge of $id did not complete: $($result.Text)"
    return 'conflict'
  }
  $problem = Test-Main "main-$id"
  if ($problem) {
    $revert = Git @('revert', '-m', '1', '--no-edit', 'HEAD')
    if ($revert.Code -ne 0) {
      Git @('revert', '--abort') | Out-Null
      Log "CRITICAL: main is red after merging $id ($problem) and the revert failed: needs a person"
      $script:halt = $true
    } else {
      Log "main gate red after merging $id ($problem): merge reverted"
    }
    return 'red'
  }
  Log "merged $id at $((Git @('rev-parse', '--short', 'HEAD')).Text), main gate green"
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
            $entry.model = 'opencode/deepseek-v4.1-flash-free'
            Log "codex is out of quota, $id moves to opencode"
          } else {
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
        [void][int]::TryParse((Git @('rev-list', '--count', "main..$($task.branch)")).Text, [ref]$count)
        if ($count -gt 0) {
          $entry.status = 'verified'
          Log "$id has $count commit(s) ready to merge"
        } elseif (((Get-Date) - [datetime]$entry.since).TotalHours -gt 6) {
          $entry.status = 'blocked'
          $entry.note = 'no commit after 6 hours'
        }
      }
      'finished' {
        $verdict = Test-Task $id ([bool]$task.allowShared)
        $entry.note = $verdict.Summary
        if ($verdict.Ok) {
          $entry.status = 'verified'
          Log "$id passed the gate ($($verdict.Summary))"
        } elseif ($entry.attempt -ge $MaxAttempts) {
          $entry.status = 'failed'
          Log "$id still failing after $($entry.attempt) runs ($($verdict.Summary))"
        } else {
          if ($verdict.Changed -eq 0 -and (Test-Exhausted $id)) {
            $toolDown[$entry.tool] = $true
            Log "$($entry.tool) looks out of quota"
            if ($entry.tool -eq 'codex') {
              $entry.tool = 'opencode'
              $entry.model = 'opencode/deepseek-v4.1-flash-free'
            } else {
              $entry.status = 'blocked'
              $entry.note = 'opencode out of quota'
              break
            }
          }
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
        $outcome = Merge-Task $task
        if ($outcome -eq 'merged') { $entry.status = 'merged' }
        elseif ($outcome -eq 'conflict') { $entry.status = 'blocked'; $entry.note = 'merge conflict' }
        elseif ($outcome -eq 'red') { $entry.status = 'blocked'; $entry.note = 'main went red after the merge; merge reverted' }
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
