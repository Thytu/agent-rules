#!/usr/bin/env bash
set -euo pipefail

mode=full
if [ "${1:-}" = "--source" ]; then mode=source; shift; elif [ "${1:-}" = "--structure-only" ]; then mode=structure; shift; fi
[ "$#" -eq 0 ] || { echo "verify: unexpected arguments" >&2; exit 2; }

script_dir="$(cd "$(dirname "$0")" && pwd -P)"
if [ "$mode" = source ]; then root="$(cd "$script_dir/../../../.." && pwd -P)"; else root="$(cd "$script_dir/.." && pwd -P)"; fi
fail() { echo "verify: $*" >&2; exit 1; }
require() { [ -e "$root/$1" ] || fail "missing required path $1"; }

check_map() {
	local map="$1" budget path rule
	budget="$(wc -l < "$map" | tr -d ' ')"
	[ "$budget" -le 60 ] || fail "$map exceeds 60 lines"
	if [ "$map" = "$root/AGENTS.md" ]; then
		[ "$(readlink "$root/CLAUDE.md" || true)" = AGENTS.md ] || fail "CLAUDE.md must be a symlink to AGENTS.md"
	fi
	while IFS= read -r path; do
		[ -e "$root/$path" ] || fail "$map maps missing path $path"
	done < <(grep -oE '`(docs/[A-Za-z0-9._/-]+|[A-Z][A-Z-]+\.md|scripts/[A-Za-z0-9._/-]+|tooling/[A-Za-z0-9._/-]+|template/[A-Za-z0-9._/-]+|\.agents/[A-Za-z0-9._/-]+|Cargo\.toml|rust-toolchain\.toml|clippy\.toml|package\.json|tsconfig\.json|eslint\.config\.mjs|pyproject\.toml|pylint-shape-boundaries\.rc)`' "$map" | tr -d '\`' | sort -u)
	if [ "$map" = "$root/AGENTS.md" ]; then
		for rule in "$root"/docs/rules/*.md; do
			path="docs/rules/$(basename "$rule")"
			grep -Fq "\`$path\`" "$map" || fail "AGENTS.md does not map rule owner $path"
		done
	fi
	[ "$mode" = source ] || ! grep -Fq '<!-- LANGUAGE_ROWS -->' "$map" || fail "unresolved language map rows"
}

check_nested_maps() {
	local map map_rel parent_dir parent_map
	while IFS= read -r map; do
		map_rel="${map#$root/}"
		parent_dir="$(dirname "$(dirname "$map")")"
		parent_map="$root/AGENTS.md"
		while [ "$parent_dir" != "$root" ]; do
			if [ -f "$parent_dir/AGENTS.md" ]; then parent_map="$parent_dir/AGENTS.md"; break; fi
			parent_dir="$(dirname "$parent_dir")"
		done
		grep -Fq "\`$map_rel\`" "$parent_map" || fail "$parent_map does not route to nested map $map_rel"
		check_map "$map"
	done < <(find "$root" -type f -name AGENTS.md ! -path "$root/AGENTS.md" ! -path "$root/template/*" ! -path '*/node_modules/*' ! -path '*/.git/*')
	while IFS= read -r map; do fail "nested CLAUDE.md entry ${map#$root/}"; done < <(find "$root" -type f -name CLAUDE.md ! -path "$root/CLAUDE.md" ! -path "$root/template/*" ! -path '*/node_modules/*' ! -path '*/.git/*')
}

check_workflows() {
	local actionlint="${ACTIONLINT_BIN:-$root/.agent-rules/tools/actionlint}" workflow
	[ -x "$actionlint" ] || fail "Actionlint missing; run the setup script"
	while IFS= read -r workflow; do "$actionlint" "$workflow"; done < <(
		find "$root/.github/workflows" -type f \( -name '*.yml' -o -name '*.yaml' \)
		if [ "$mode" = source ]; then find "$root/template/core/files/.github/workflows" -type f \( -name '*.yml' -o -name '*.yaml' \); fi
	)
}

if [ "$mode" = source ]; then
	for path in AGENTS.md CLAUDE.md README.md init.sh package.json pnpm-lock.yaml .agents/skills docs/rules template/core/files/scripts/verify.sh template/python/files template/python/agent-map.rows template/rust/files template/rust/agent-map.rows template/typescript/files template/typescript/agent-map.rows test/generator tooling/pr-review .github/workflows/ci.yml .github/workflows/pull-request.yml .github/workflows/ai-review.yml; do require "$path"; done
	[ ! -e "$root/scripts/check-map.sh" ] || fail "legacy check-map.sh must be removed"
	for path in .github/dependabot.yml template/core/dependabot.update.yml template/python/dependabot.update.yml template/rust/dependabot.update.yml template/typescript/dependabot.update.yml; do [ ! -e "$root/$path" ] || fail "scheduled Dependabot configuration must be absent: $path"; done
	[ ! -e "$root/docs/profiles" ] || fail "language profile documents must be absent"
	check_map "$root/AGENTS.md"
	check_nested_maps
	check_workflows
	exit 0
fi

for path in AGENTS.md CLAUDE.md README.md docs/rules .githooks .github/workflows/ci.yml .github/workflows/pull-request.yml scripts/setup.sh scripts/setup-github.sh scripts/verify.sh scripts/guard-append-only.sh scripts/commit-msg.sh; do require "$path"; done
for forbidden in init.sh template tooling/pr-review test/generator scripts/setup-source.sh .agents .claude docs/profiles; do [ ! -e "$root/$forbidden" ] || fail "generator path survived: $forbidden"; done
check_map "$root/AGENTS.md"
check_nested_maps
check_workflows
[ -x "$root/.githooks/pre-commit" ] || fail "pre-commit hook is not executable"
[ -x "$root/.githooks/pre-push" ] || fail "pre-push hook is not executable"
[ -x "$root/scripts/setup.sh" ] || fail "setup.sh is not executable"

if [ -f "$root/pyproject.toml" ] || [ -f "$root/uv.lock" ]; then
	require .python-version
	require pyproject.toml
	require uv.lock
	require pylint-shape-boundaries.rc
	require scripts/setup-python.sh
	require scripts/verify-python.sh
else
	for path in .python-version pyproject.toml uv.lock pylint-shape-boundaries.rc scripts/setup-python.sh scripts/verify-python.sh; do [ ! -e "$root/$path" ] || fail "unselected Python policy exists: $path"; done
fi
if [ -f "$root/Cargo.toml" ]; then require scripts/verify-rust.sh; else
	for path in Cargo.toml Cargo.lock rust-toolchain.toml rustfmt.toml clippy.toml deny.toml .cargo scripts/setup-rust.sh scripts/verify-rust.sh; do [ ! -e "$root/$path" ] || fail "unselected Rust path exists: $path"; done
fi
if [ -f "$root/package.json" ] && [ -f "$root/tsconfig.json" ]; then
	require scripts/setup-typescript.sh
	require scripts/verify-typescript.sh
else
	[ ! -f "$root/tsconfig.json" ] || fail "tsconfig.json exists without package.json"
	for path in scripts/setup-typescript.sh scripts/verify-typescript.sh; do [ ! -e "$root/$path" ] || fail "unselected TypeScript policy exists: $path"; done
fi

[ "$mode" = structure ] && exit 0
if grep -R -n 'REPLACE_ME' "$root/docs/rules"; then fail "active rule documents still contain REPLACE_ME"; fi
if [ -x "$root/scripts/verify-python.sh" ]; then "$root/scripts/verify-python.sh"; fi
if [ -x "$root/scripts/verify-rust.sh" ]; then "$root/scripts/verify-rust.sh"; fi
if [ -x "$root/scripts/verify-typescript.sh" ]; then "$root/scripts/verify-typescript.sh"; fi
