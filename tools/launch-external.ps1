# Starts an external coding CLI (Codex or OpenCode) on one task in its own git worktree.
#   powershell -File tools\launch-external.ps1 -Tool codex    -Id colour-engine
#   powershell -File tools\launch-external.ps1 -Tool opencode -Id kb-pack -Model opencode/deepseek-v4.1-flash-free
#
# Safety: Codex runs with its workspace-write sandbox; OpenCode runs with a
# least-privilege project config (edit allowed, shell/web/outside-project denied)
# and no --auto flag. Neither may commit: the integrator reviews and commits.
param(
  [Parameter(Mandatory)][ValidateSet('codex', 'opencode')][string]$Tool,
  [Parameter(Mandatory)][string]$Id,
  [string]$Model = '',
  [string]$Message = ''   # replaces the default instruction, e.g. for a second pass on an existing worktree
)
$ErrorActionPreference = 'Stop'
$repo = 'D:\Sofa_Factory'
$wt = "D:\Sofa_Factory_wt\$Id"
$logs = 'D:\Sofa_Factory_wt\_logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null

if (-not (Test-Path $wt)) { git -C $repo worktree add -q $wt -b "wt/$Id" HEAD }
$modules = "$wt\web\node_modules"
if (-not (Test-Path $modules)) { New-Item -ItemType Junction -Path $modules -Target "$repo\web\node_modules" | Out-Null }

$task = "web/docs/tasks/$Id.md"
if (-not (Test-Path "$wt\$task")) { throw "Task file missing in the worktree: $task" }
# No parentheses or shell metacharacters here: OpenCode receives this as command-line words through a .cmd file.
$limits = if ($Tool -eq 'codex') { 'You can read files and run ordinary shell commands, but Node, npm, tsc, eslint and vitest cannot run in this sandbox.' } else { 'You have no shell, only file read, search and edit tools.' }
$message = if ($Message) { $Message } else { "Read $task and web/docs/BUILD-GUIDE.md and complete the task exactly as specified. Follow every rule in them. $limits That is expected and is not a reason to skip or shorten anything. Finish every deliverable, including every test listed in the Tests section of the spec. The integrator runs tsc, eslint and vitest afterwards and sends failures back. Write in the house style of src/lib/bookings: one statement per line, one import per line, lines under 120 characters. Do not commit." }

if ($Tool -eq 'codex') {
  $exe = "$env:USERPROFILE\.codex\packages\app-server-daemon\current\bin\codex.exe"
  $promptFile = "$logs\$Id.prompt.txt"
  Set-Content -Path $promptFile -Value $message -Encoding utf8
  $arguments = @('exec', '-C', $wt, '-s', 'workspace-write', '--color', 'never', '-o', "$logs\$Id.last.txt")
  if ($Model) { $arguments += @('-m', $Model) }
  $arguments += '-'
  $process = Start-Process -FilePath $exe -ArgumentList $arguments -RedirectStandardInput $promptFile -RedirectStandardOutput "$logs\$Id.out" -RedirectStandardError "$logs\$Id.err" -WindowStyle Hidden -PassThru
}
else {
  if (-not $Model) { throw 'OpenCode needs -Model (an opencode-go/ model from the OpenCode Go plan, or a free model ending in -free).' }
  if ($Model -notmatch '^opencode-go/' -and $Model -notmatch 'free$') { throw "Refusing OpenCode model outside the Go plan and the free tier: $Model" }
  @'
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "edit": "allow",
    "bash": "deny",
    "webfetch": "deny",
    "external_directory": "deny"
  }
}
'@ | Set-Content -Path "$wt\opencode.json" -Encoding utf8
  $exe = "$env:APPDATA\npm\opencode.cmd"
  $arguments = @('run', '-m', $Model, '--title', $Id) + $message.Split(' ')
  $process = Start-Process -FilePath $exe -ArgumentList $arguments -WorkingDirectory $wt -RedirectStandardOutput "$logs\$Id.out" -RedirectStandardError "$logs\$Id.err" -WindowStyle Hidden -PassThru
}
Set-Content -Path "$logs\$Id.pid" -Value $process.Id
"$Tool started for '$Id' (pid $($process.Id)); worktree $wt; logs $logs\$Id.*"
