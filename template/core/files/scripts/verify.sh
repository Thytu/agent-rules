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
	local map="$1" budget path
	budget="$(wc -l < "$map" | tr -d ' ')"
	[ "$budget" -le 60 ] || fail "AGENTS.md exceeds 60 lines"
	[ "$(readlink "$root/CLAUDE.md" || true)" = AGENTS.md ] || fail "CLAUDE.md must be a symlink to AGENTS.md"
	while IFS= read -r path; do
		[ -e "$root/$path" ] || fail "AGENTS.md maps missing path $path"
	done < <(grep -oE '`(docs/[A-Za-z0-9._/-]+|[A-Z][A-Z-]+\.md|scripts/[A-Za-z0-9._/-]+|tooling/[A-Za-z0-9._/-]+)`' "$map" | tr -d '\`' | sort -u)
	while IFS= read -r path; do fail "nested agent entry ${path#$root/}"; done < <(find "$root" -type f \( -name AGENTS.md -o -name CLAUDE.md \) ! -path "$root/AGENTS.md" ! -path "$root/CLAUDE.md" ! -path "$root/template/*" ! -path '*/node_modules/*' ! -path '*/.git/*')
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
	for path in AGENTS.md CLAUDE.md SCOPE.md VERIFICATION.md README.md init.sh package.json pnpm-lock.yaml docs/rules docs/profiles docs/scenarios/01-init.yaml template/core/files/scripts/verify.sh template/rust/files template/typescript/files test/generator tooling/pr-review .github/workflows/ci.yml .github/workflows/guard.yml .github/workflows/ai-review.yml; do require "$path"; done
	[ ! -e "$root/lefthook.yml" ] || fail "Lefthook must be removed"
	[ ! -e "$root/scripts/check-map.sh" ] || fail "legacy check-map.sh must be removed"
	check_map "$root/AGENTS.md"
	check_workflows
	exit 0
fi

for path in AGENTS.md CLAUDE.md README.md SCOPE.md VERIFICATION.md docs/rules docs/profiles docs/scenarios .githooks .github/workflows/ci.yml .github/workflows/guard.yml .agent-rules/guarded-paths/core.txt scripts/setup.sh scripts/setup-github.sh scripts/verify.sh scripts/authorize-changes.sh scripts/guard-shared.sh scripts/guard-append-only.sh scripts/commit-msg.sh; do require "$path"; done
for forbidden in init.sh template tooling/pr-review test/generator scripts/setup-source.sh; do [ ! -e "$root/$forbidden" ] || fail "generator path survived: $forbidden"; done
check_map "$root/AGENTS.md"
check_workflows
[ -x "$root/.githooks/pre-commit" ] || fail "pre-commit hook is not executable"
[ -x "$root/.githooks/pre-push" ] || fail "pre-push hook is not executable"
[ -x "$root/scripts/setup.sh" ] || fail "setup.sh is not executable"
[ -s "$root/.github/dependabot.yml" ] || fail "Dependabot config missing"
grep -q '^version: 2$' "$root/.github/dependabot.yml" || fail "Dependabot version header invalid"
grep -q '^updates:$' "$root/.github/dependabot.yml" || fail "Dependabot updates header invalid"

if [ -f "$root/Cargo.toml" ]; then require docs/profiles/rust.md; require scripts/verify-rust.sh; else
	for path in Cargo.toml Cargo.lock rust-toolchain.toml rustfmt.toml clippy.toml deny.toml .cargo scripts/setup-rust.sh scripts/verify-rust.sh docs/profiles/rust.md; do [ ! -e "$root/$path" ] || fail "unselected Rust path exists: $path"; done
fi
if [ -f "$root/docs/profiles/typescript.md" ]; then
	require package.json
	require tsconfig.json
	require scripts/setup-typescript.sh
	require scripts/verify-typescript.sh
elif [ -f "$root/package.json" ] && [ -f "$root/tsconfig.json" ]; then
	fail "TypeScript markers exist without the selected TypeScript profile"
else
	for path in scripts/setup-typescript.sh scripts/verify-typescript.sh .agent-rules/guarded-paths/typescript.txt docs/profiles/typescript.md; do [ ! -e "$root/$path" ] || fail "unselected TypeScript policy exists: $path"; done
fi

[ "$mode" = structure ] && exit 0
[ ! -e "$root/docs/scenarios/00-example.yaml" ] || fail "replace the example scenario"
if grep -R -n 'REPLACE_ME' "$root/SCOPE.md" "$root/VERIFICATION.md" "$root/docs/rules" "$root/docs/profiles" "$root/docs/scenarios"; then fail "active product contracts still contain REPLACE_ME"; fi
[ -x "$root/scripts/verify-rust.sh" ] && "$root/scripts/verify-rust.sh"
[ -x "$root/scripts/verify-typescript.sh" ] && "$root/scripts/verify-typescript.sh"
