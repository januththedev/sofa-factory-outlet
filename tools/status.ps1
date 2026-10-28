# One-screen status of the autopilot: queue, orchestrator, last merges, memory.
#   & D:\Sofa_Factory\tools\status.ps1
$logs = 'D:\Sofa_Factory_wt\_logs'
if (Test-Path "$logs\orchestrator.pid") {
  $orchestrator = Get-Process -Id ([int](Get-Content "$logs\orchestrator.pid")) -ErrorAction SilentlyContinue
  "orchestrator: " + $(if ($orchestrator) { "running (pid $($orchestrator.Id))" } else { 'NOT running' })
} else { 'orchestrator: never started' }
''
if (Test-Path "$logs\state.json") {
  $state = Get-Content "$logs\state.json" -Raw | ConvertFrom-Json
  foreach ($entry in $state.PSObject.Properties) {
    '{0,-18} {1,-9} {2,-9} run {3}  {4}' -f $entry.Name, $entry.Value.tool, $entry.Value.status, $entry.Value.attempt, $entry.Value.note
  }
}
''
'--- orchestrator log (last 12)'
if (Test-Path "$logs\orchestrator.log") { Get-Content "$logs\orchestrator.log" -Tail 12 }
''
'--- main'
git -C D:\Sofa_Factory log --oneline -6
''
$os = Get-CimInstance Win32_OperatingSystem
'free RAM {0:N2} GB, commit headroom {1:N2} GB' -f ($os.FreePhysicalMemory / 1MB), ($os.FreeVirtualMemory / 1MB)
