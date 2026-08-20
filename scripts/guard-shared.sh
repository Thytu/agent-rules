#!/usr/bin/env bash
# ENFORCED shared-file protocol (docs/rules/process.md). Feature worktrees must
# not touch these; the integration owner overrides with ALLOW_SCHEMA_CHANGE=1.
# Edit the list below when this repo's real paths exist.
set -euo pipefail
[ "${ALLOW_SCHEMA_CHANGE:-0}" = "1" ] && exit 0

# Integration-owned paths. Drop a line when the file/dir exists in this repo.
GUARDED='^(package\.json|pnpm-lock\.yaml)$'

staged="$(git diff --cached --name-only)"
if printf '%s\n' "$staged" | grep -Eq "$GUARDED"; then
	echo "You are editing an integration-owned shared file."
	echo "   Feature worktrees must not touch the guarded list in scripts/guard-shared.sh."
	echo "   Need a column, dep, binding, or UI primitive? Request it from the integration owner."
	echo "   Integration owner: re-run as  ALLOW_SCHEMA_CHANGE=1 git commit ..."
	exit 1
fi
