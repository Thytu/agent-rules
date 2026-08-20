#!/usr/bin/env bash
# AGENTS.md is a map, not a manual: enforce the line budget, that every repo
# path it maps actually exists, that vendor entry points stay pointer shims,
# and that no nested AGENTS.md / CLAUDE.md appears.
set -euo pipefail
cd "$(dirname "$0")/.."

MAP="AGENTS.md"
BUDGET=60

if [ "$(readlink CLAUDE.md || true)" != "AGENTS.md" ]; then
	echo "check-map: CLAUDE.md must be a symlink to AGENTS.md." >&2
	echo "Vendor filenames are pointer shims; the one map lives in AGENTS.md (docs/rules/process.md → Agent harness)." >&2
	exit 1
fi


lines=$(wc -l < "$MAP" | tr -d ' ')
if [ "$lines" -gt "$BUDGET" ]; then
	echo "check-map: $MAP is $lines lines (budget: $BUDGET)." >&2
	echo "It is a MAP — move new prose into docs/rules/ or the mapped doc, and keep one row per topic here." >&2
	exit 1
fi

status=0
while IFS= read -r path; do
	if [ ! -e "$path" ]; then
		echo "check-map: $MAP maps '$path' but it does not exist." >&2
		status=1
	fi
done < <(grep -oE '`(docs/[A-Za-z0-9._/-]+|[A-Z][A-Z-]+\.md|scripts/[A-Za-z0-9._-]+|tooling/[A-Za-z0-9._/-]+)`' "$MAP" | tr -d '\`' | sort -u)

while IFS= read -r extra; do
	echo "check-map: nested agent entry '$extra' — one map lives at the repo root. Delete it or turn it into a symlink." >&2
	status=1
done < <(find . -type f \( -name AGENTS.md -o -name CLAUDE.md \) \
	! -path ./AGENTS.md ! -path ./CLAUDE.md \
	! -path './node_modules/*' ! -path './.git/*' ! -path './.claude/worktrees/*')

exit "$status"
