# Commits an external agent's worktree (never the node_modules junction, opencode.json or a fix-pass file)
# and merges its branch into main. Run only after verify-worktree.ps1 is green.
#   & tools\merge-worktree.ps1 -Id product-page -Message "feat(product): product page" -Writer Codex
param(
  [Parameter(Mandatory)][string]$Id,
  [Parameter(Mandatory)][string]$Message,
  [string]$Writer = 'an external agent'
)
$wt = "D:\Sofa_Factory_wt\$Id"
$repo = 'D:\Sofa_Factory'
$body = "$Message`n`nWritten by $Writer; the integrator ran tsc, eslint and vitest on it.`n`nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git -C $wt add web ":(exclude)web/docs/tasks/_fix-*.md"
git -C $wt commit -q -m $body
git -C $repo merge --no-ff -q "wt/$Id" -m "Merge wt/$Id"
git -C $repo log --oneline -3
git -C $repo status --short | Select-Object -First 8
