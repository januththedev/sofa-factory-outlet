# Test stub: prints the canned report named by $env:SCENARIO_REPORT.
param([string]$Id, [switch]$Wait)
Get-Content $env:SCENARIO_REPORT
