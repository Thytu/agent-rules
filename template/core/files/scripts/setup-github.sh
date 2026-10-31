#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd -P)"
command -v gh >/dev/null || { echo "setup-github: gh is required" >&2; exit 1; }
gh auth status >/dev/null || { echo "setup-github: gh is not authenticated" >&2; exit 1; }
repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
gh api -X PUT "repos/$repo/vulnerability-alerts"
gh api -X PATCH "repos/$repo" --input - <<'JSON'
{"allow_squash_merge":true,"allow_merge_commit":false,"allow_rebase_merge":false,"delete_branch_on_merge":true,"squash_merge_commit_title":"PR_TITLE","squash_merge_commit_message":"PR_BODY","has_wiki":false}
JSON
# Required checks are pinned to GitHub Actions (app 15368), so no other app or token
# can satisfy them by posting a status with the same name. Rulesets have no bypass.
upsert() {
	local name="$1" body="$2" id
	id="$(gh api "repos/$repo/rulesets" | jq -r --arg name "$name" '.[] | select(.name == $name) | .id')"
	if [ -n "$id" ]; then gh api -X PUT "repos/$repo/rulesets/$id" --input - <<<"$body"; else gh api -X POST "repos/$repo/rulesets" --input - <<<"$body"; fi
}
upsert "No force-push" '{"name":"No force-push","target":"branch","enforcement":"active","bypass_actors":[],"conditions":{"ref_name":{"include":["~ALL"],"exclude":[]}},"rules":[{"type":"non_fast_forward"}]}'
# Every workflow job that guards main is required; add-on workflows add theirs.
checks='{"context":"PR targets main","integration_id":15368},{"context":"Repository quality","integration_id":15368},{"context":"Gitleaks","integration_id":15368}'
[ ! -f "$root/.github/workflows/bundle-budgets.yml" ] || checks="$checks"',{"context":"Bundle budgets","integration_id":15368}'
upsert "Main is PR-only" '{"name":"Main is PR-only","target":"branch","enforcement":"active","bypass_actors":[],"conditions":{"ref_name":{"include":["~DEFAULT_BRANCH"],"exclude":[]}},"rules":[{"type":"pull_request","parameters":{"required_approving_review_count":0,"dismiss_stale_reviews_on_push":false,"require_code_owner_review":false,"require_last_push_approval":false,"required_review_thread_resolution":true,"allowed_merge_methods":["squash"]}},{"type":"required_status_checks","parameters":{"strict_required_status_checks_policy":true,"do_not_enforce_on_create":false,"required_status_checks":['"$checks"']}}]}'
echo "setup-github: configured $repo; vulnerability alerts enabled; automated security pull-request preference preserved"
