#!/usr/bin/env bash
set -euo pipefail
mode=generated
[ "${1:-}" = "--source" ] && { mode=source; shift; }
changed="${1:?usage: authorize-changes.sh [--source] <nul-path-file>}"

if [ "${HEAD_REPO:-}" = "${BASE_REPO:-}" ] && [ -n "${INTEGRATION_OWNER:-}" ] && [ "${ACTOR:-}" = "$INTEGRATION_OWNER" ] && [[ "${HEAD_REF:-}" == integration/* ]]; then
	exit 0
fi

if [ "${ACTOR:-}" = 'dependabot[bot]' ] && [[ "${HEAD_REF:-}" == dependabot/* ]]; then
	allowed=true
	while IFS= read -r -d '' path; do
		if [ "$mode" = source ]; then
			case "$path" in package.json|pnpm-lock.yaml) ;; *) allowed=false ;; esac
		else
			case "$path" in Cargo.toml|*/Cargo.toml|Cargo.lock|package.json|*/package.json|pnpm-lock.yaml) ;; *) allowed=false ;; esac
		fi
	done < "$changed"
	$allowed && exit 0
fi

root="$(git rev-parse --show-toplevel)"
lists=("$root/.agent-rules/guarded-paths"/*.txt)
[ "$mode" = source ] && lists=("$root/template/core/files/.agent-rules/guarded-paths/core.txt" "$root/template/rust/files/.agent-rules/guarded-paths/rust.txt" "$root/template/typescript/files/.agent-rules/guarded-paths/typescript.txt")
while IFS= read -r -d '' path; do
	if [ "$mode" = source ]; then
		case "$path" in AGENTS.md|CLAUDE.md|package.json|pnpm-lock.yaml|.npmrc|biome.json|eslint.config.mjs|init.sh|template/*|.agents/*|.claude/*|.github/*|.githooks/*|scripts/setup-source.sh|scripts/setup-github.sh|docs/rules/*|docs/profiles/*)
			echo "unauthorized integration-owned source path: $path" >&2
			exit 1
			;;
		esac
	else
		for list in "${lists[@]}"; do
			[ -f "$list" ] || continue
			while IFS= read -r pattern; do
				[ -n "$pattern" ] || continue
				case "$path" in $pattern) echo "unauthorized integration-owned path: $path" >&2; exit 1 ;; esac
			done < "$list"
		done
	fi
done < "$changed"
