#!/usr/bin/env bash
# Apply docs/rules/process.md → Git repo-setup to the GitHub remote.
# "Use this template" copies files, not settings. Run once on the new repo.
set -euo pipefail

command -v gh >/dev/null || {
	echo "setup-github: gh is required." >&2
	exit 1
}
gh auth status >/dev/null || {
	echo "setup-github: gh is not authenticated." >&2
	exit 1
}

repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"

gh api -X PATCH "repos/${repo}" --input - <<'EOF'
{
  "allow_squash_merge": true,
  "allow_merge_commit": false,
  "allow_rebase_merge": false,
  "delete_branch_on_merge": true,
  "squash_merge_commit_title": "PR_TITLE",
  "squash_merge_commit_message": "PR_BODY",
  "has_wiki": false
}
EOF

upsert_ruleset() {
	local name="$1"
	local body="$2"
	local id
	id="$(gh api "repos/${repo}/rulesets" | jq -r --arg name "$name" \
		'.[] | select(.name == $name) | .id')"
	if [ -n "$id" ]; then
		gh api -X PUT "repos/${repo}/rulesets/${id}" --input - <<<"$body"
	else
		gh api -X POST "repos/${repo}/rulesets" --input - <<<"$body"
	fi
}

upsert_ruleset "No force-push" '{
  "name": "No force-push",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~ALL"], "exclude": [] } },
  "rules": [{ "type": "non_fast_forward" }]
}'

upsert_ruleset "Main is PR-only" '{
  "name": "Main is PR-only",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true,
        "allowed_merge_methods": ["squash"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "do_not_enforce_on_create": false,
        "required_status_checks": [
          { "context": "PR targets main" },
          { "context": "Shared-file ownership" },
          { "context": "Template quality" }
        ]
      }
    }
  ]
}'

echo "setup-github: ${repo} — squash-only, auto-delete heads, no force-push, resolved threads, and required CI checks."
