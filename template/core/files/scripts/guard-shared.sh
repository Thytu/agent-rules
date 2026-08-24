#!/usr/bin/env bash
set -euo pipefail

mode=generated
[ "${1:-}" = "--source" ] && { mode=source; shift; }
[ "$#" -eq 0 ] || { echo "guard-shared: unexpected arguments" >&2; exit 2; }
script_dir="$(cd "$(dirname "$0")" && pwd -P)"
if [ "$mode" = source ]; then root="$(cd "$script_dir/../../../.." && pwd -P)"; else root="$(cd "$script_dir/.." && pwd -P)"; fi
[ "${ALLOW_SHARED_CHANGE:-0}" = 1 ] && exit 0

lists=("$root/.agent-rules/guarded-paths"/*.txt)
[ "$mode" = source ] && lists=("$root/template/core/files/.agent-rules/guarded-paths/core.txt" "$root/template/rust/files/.agent-rules/guarded-paths/rust.txt" "$root/template/typescript/files/.agent-rules/guarded-paths/typescript.txt")

matches=0
while IFS= read -r -d '' path; do
	[ "$mode" = source ] && case "$path" in README.md|init.sh|template/*|.agents/*|.claude/*|package.json|pnpm-lock.yaml|.github/*|scripts/setup-source.sh|scripts/setup-github.sh|docs/rules/*) matches=1 ;; esac
	for list in "${lists[@]}"; do
		[ -f "$list" ] || continue
		while IFS= read -r pattern; do
			[ -n "$pattern" ] || continue
			case "$path" in $pattern) matches=1 ;; esac
		done < "$list"
	done
done < <(git -C "$root" diff --cached --name-only -z --no-renames)

[ "$matches" -eq 0 ] || {
	echo "guard-shared: staged change touches integration-owned policy or shared files" >&2
	echo "Request the change from the integration owner, or re-run with ALLOW_SHARED_CHANGE=1 as that owner." >&2
	exit 1
}
