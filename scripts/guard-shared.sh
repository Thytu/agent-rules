#!/usr/bin/env bash
# ENFORCED shared-file protocol (docs/rules/process.md). Feature worktrees must
# not touch these; the integration owner overrides with ALLOW_SCHEMA_CHANGE=1.
# Edit the list below when this repo's real paths exist.
set -euo pipefail
[ "${ALLOW_SCHEMA_CHANGE:-0}" = "1" ] && exit 0

# Integration-owned paths. Optional-profile entries are harmless until present.
GUARDED='^(package\.json|pnpm-lock\.yaml|Cargo\.toml|Cargo\.lock|rust-toolchain\.toml|rustfmt\.toml|clippy\.toml|deny\.toml|biome\.json|eslint\.config\.mjs|commitlint\.config\.mjs|lefthook\.yml|\.cargo/.*|\.github/workflows/.*|\.github/dependabot\.yml|scripts/(guard-shared|setup-github|setup-rust-tools|verify-rust)\.sh)$'

staged="$(git diff --cached --name-only)"
if printf '%s\n' "$staged" | grep -Eq "$GUARDED"; then
	echo "You are editing an integration-owned shared file."
	echo "   Feature worktrees must not touch manifests, lockfiles, toolchain policy, or other guarded paths."
	echo "   Request the change from the integration owner."
	echo "   Integration owner: re-run as  ALLOW_SCHEMA_CHANGE=1 git commit ..."
	exit 1
fi
