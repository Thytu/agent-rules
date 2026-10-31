#!/usr/bin/env bash
set -euo pipefail

# Modes: full (default; pre-push and CI), --commit (the exact staged tree, run by
# scripts/verify-commit.sh), --structure-only (repository shape only), and
# --source (the generator checkout).
mode=full
case "${1:-}" in
	--source) mode=source; shift ;;
	--structure-only) mode=structure; shift ;;
	--commit) mode=commit; shift ;;
esac
[ "$#" -eq 0 ] || { echo "verify: unexpected arguments" >&2; exit 2; }

script_dir="$(cd "$(dirname "$0")" && pwd -P)"
if [ "$mode" = source ]; then root="$(cd "$script_dir/../../../.." && pwd -P)"; else root="$(cd "$script_dir/.." && pwd -P)"; fi
tools="$root/.agent-rules/tools"
fail() { echo "verify: $*" >&2; exit 1; }
require() { [ -e "$root/$1" ] || fail "missing required path $1"; }
step() { echo "verify: $*"; }

check_map() {
	local map="$1" budget path rule
	budget="$(wc -l < "$map" | tr -d ' ')"
	[ "$budget" -le 60 ] || fail "$map exceeds 60 lines"
	if [ "$map" = "$root/AGENTS.md" ]; then
		[ "$(readlink "$root/CLAUDE.md" || true)" = AGENTS.md ] || fail "CLAUDE.md must be a symlink to AGENTS.md"
	fi
	while IFS= read -r path; do
		[ -e "$root/$path" ] || fail "$map maps missing path $path"
	done < <(grep -oE '`(docs/[A-Za-z0-9._/-]+|[A-Z][A-Z-]+\.md|scripts/[A-Za-z0-9._/-]+|tooling/[A-Za-z0-9._/-]+|template/[A-Za-z0-9._/-]+|\.agents/[A-Za-z0-9._/-]+|Cargo\.toml|rust-toolchain\.toml|clippy\.toml|package\.json|tsconfig\.json|eslint\.config\.mjs|next\.config\.ts|drizzle\.config\.ts|bundle-budgets\.json|pyproject\.toml|pylint-shape-boundaries\.rc)`' "$map" | tr -d '\`' | sort -u)
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
	local actionlint="${ACTIONLINT_BIN:-$tools/actionlint}" workflow
	[ -x "$actionlint" ] || fail "Actionlint missing; run the setup script"
	while IFS= read -r workflow; do "$actionlint" "$workflow"; done < <(
		find "$root/.github/workflows" -type f \( -name '*.yml' -o -name '*.yaml' \)
		if [ "$mode" = source ]; then find "$root/template/core/files/.github/workflows" -type f \( -name '*.yml' -o -name '*.yaml' \); fi
	)
}

# addon_paths NAME prints the paths an add-on owns. Selected at initialization,
# an add-on is all present or all absent.
addon_paths() {
	case "$1" in
		react) printf '%s\n' docs/rules/react.md tooling/eslint-config/react.mjs test/eslint/react.test.mjs ;;
		nextjs) printf '%s\n' docs/rules/nextjs.md next.config.ts bundle-budgets.json tooling/eslint-config/nextjs.mjs tooling/check-bundle-budgets.mjs ;;
		tailwind) printf '%s\n' docs/rules/tailwind.md tooling/eslint-config/tailwind.mjs test/eslint/tailwind.test.mjs ;;
		database) printf '%s\n' docs/rules/data-access.md drizzle.config.ts tooling/eslint-config/database.mjs tooling/check-migrations.mjs test/helpers/query-budget.ts ;;
	esac
}

addon_present() {
	local path
	while IFS= read -r path; do [ -e "$root/$path" ] && return 0; done < <(addon_paths "$1")
	return 1
}

check_addons() {
	local addon path
	for addon in react nextjs tailwind database; do
		addon_present "$addon" || continue
		[ -f "$root/package.json" ] && [ -f "$root/tsconfig.json" ] || fail "the $addon add-on requires the TypeScript tooling"
		while IFS= read -r path; do
			[ -e "$root/$path" ] || fail "the $addon add-on is incomplete: missing $path"
		done < <(addon_paths "$addon")
	done
	if addon_present nextjs && ! addon_present react; then fail "the nextjs add-on requires the react add-on"; fi
}

check_hooks() {
	[ "$(git -C "$root" config --get core.hooksPath || true)" = .githooks ] || fail "Git hooks are inactive, so commits would skip the commit gate; run bash scripts/setup.sh"
}

# A commit checks the index, exactly the blobs being committed; the push and CI
# gates check HEAD, exactly the tree being pushed.
check_file_sizes() {
	local limit=1048576 entry path size count=0 index=0 oversized=() shas listing scope
	local paths=()
	shas="$(mktemp)"
	listing="$(mktemp)"
	if [ "$mode" = commit ] || ! git -C "$root" rev-parse --verify --quiet HEAD >/dev/null; then
		scope="staged tree"
		# Each entry is "mode blob stage<TAB>path".
		git -C "$root" ls-files -s -z > "$listing"
	else
		scope="HEAD tree"
		# Each entry is "mode type blob<TAB>path"; reorder to match the index form.
		git -C "$root" ls-tree -r -z HEAD | while IFS= read -r -d '' entry; do
			set -- ${entry%%$'\t'*}
			printf '%s %s 0\t%s\0' "$1" "$3" "${entry#*$'\t'}"
		done > "$listing"
	fi
	while IFS= read -r -d '' entry; do
		path="${entry#*$'\t'}"
		set -- ${entry%%$'\t'*}
		[ "$1" = 160000 ] && continue
		paths+=("$path")
		printf '%s\n' "$2" >> "$shas"
	done < "$listing"
	rm -f "$listing"
	while IFS= read -r size; do
		path="${paths[$index]}"
		index=$((index + 1))
		count=$((count + 1))
		case "$size" in '' | *[!0-9]*) continue ;; esac
		[ "$size" -le "$limit" ] || oversized+=("$(awk -v b="$size" 'BEGIN { printf "%.1f MiB", b / 1048576 }')  $path")
	done < <(git -C "$root" cat-file --batch-check='%(objectsize)' < "$shas")
	rm -f "$shas"
	if [ "${#oversized[@]}" -gt 0 ]; then
		echo "verify: ${#oversized[@]} tracked file(s) exceed the 1 MiB limit:" >&2
		printf '  %s\n' "${oversized[@]}" >&2
		fail "split each file, generate it during the build, or keep it outside Git; history keeps every committed byte"
	fi
	step "file sizes ok ($count files in the $scope, each at most 1 MiB)"
}

check_secrets() {
	local gitleaks="$tools/gitleaks" scope args
	[ -x "$gitleaks" ] || fail "Gitleaks is missing; run bash scripts/setup.sh"
	args=(git --config "$root/.gitleaks.toml" --no-banner --redact --verbose --log-level warn)
	[ -t 2 ] && [ -z "${NO_COLOR:-}" ] || args+=(--no-color)
	if [ "$mode" = commit ]; then
		scope="staged changes"
		"$gitleaks" "${args[@]}" --pre-commit --staged "$root" || fail "Gitleaks found a credential in the $scope (redacted above). Remove it and rotate the credential if it is real. If the value is provably not a secret, allowlist that exact value and path in .gitleaks.toml"
	else
		scope="history reachable from HEAD"
		"$gitleaks" "${args[@]}" --log-opts=HEAD "$root" || fail "Gitleaks found a credential in the $scope (redacted above). A committed secret stays in history: rotate it, then remove it from the code"
	fi
	step "secrets ok ($scope)"
}

check_duplicates() {
	local jscpd="$tools/jscpd" colors=--no-colors
	[ -x "$jscpd" ] || fail "jscpd is missing; run bash scripts/setup.sh"
	[ -t 1 ] && [ -z "${NO_COLOR:-}" ] && colors=
	(cd "$root" && JSCPD_NO_TIPS=1 "$jscpd" --config .jscpd.json --no-tips ${colors:+"$colors"} .) || fail "copied code found (listed above); extract the shared logic into one owner instead of keeping two copies"
	step "duplication ok"
}

if [ "$mode" = source ]; then
	for path in AGENTS.md CLAUDE.md README.md init.sh package.json pnpm-lock.yaml .agents/skills docs/rules template/core/files/scripts/verify.sh template/core/files/scripts/verify-commit.sh template/core/files/.gitleaks.toml template/core/files/.jscpd.json template/python/files template/python/agent-map.rows template/rust/files template/rust/agent-map.rows template/typescript/files template/typescript/agent-map.rows template/typescript/lock/package.json template/typescript/lock/pnpm-lock.yaml template/addons template/init test/generator tooling/pr-review .github/workflows/ci.yml .github/workflows/pull-request.yml .github/workflows/ai-review.yml; do require "$path"; done
	[ ! -e "$root/scripts/check-map.sh" ] || fail "legacy check-map.sh must be removed"
	for path in .github/dependabot.yml template/core/dependabot.update.yml template/python/dependabot.update.yml template/rust/dependabot.update.yml template/typescript/dependabot.update.yml; do [ ! -e "$root/$path" ] || fail "scheduled Dependabot configuration must be absent: $path"; done
	[ ! -e "$root/docs/profiles" ] || fail "language profile documents must be absent"
	check_map "$root/AGENTS.md"
	check_nested_maps
	check_workflows
	exit 0
fi

for path in AGENTS.md CLAUDE.md README.md docs/rules .githooks .gitleaks.toml .jscpd.json .github/workflows/ci.yml .github/workflows/pull-request.yml .github/workflows/secret-scanning.yml scripts/setup.sh scripts/setup-github.sh scripts/verify.sh scripts/verify-commit.sh scripts/verify-mode.sh scripts/guard-append-only.sh scripts/commit-msg.sh; do require "$path"; done
for forbidden in init.sh template tooling/pr-review test/generator scripts/setup-source.sh .agents .claude docs/profiles; do [ ! -e "$root/$forbidden" ] || fail "generator path survived: $forbidden"; done
check_addons
check_map "$root/AGENTS.md"
check_nested_maps
check_workflows
for hook in pre-commit pre-merge-commit pre-push; do [ -x "$root/.githooks/$hook" ] || fail "$hook hook is not executable"; done
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
	require .c8rc.json
else
	[ ! -f "$root/tsconfig.json" ] || fail "tsconfig.json exists without package.json"
	for path in scripts/setup-typescript.sh scripts/verify-typescript.sh .c8rc.json; do [ ! -e "$root/$path" ] || fail "unselected TypeScript policy exists: $path"; done
fi

[ "$mode" = structure ] && exit 0
step "structure ok"
if grep -R -n 'REPLACE_ME' "$root/docs/rules"; then fail "active rule documents still contain REPLACE_ME"; fi
check_hooks
check_file_sizes
check_secrets
check_duplicates
for language in python rust typescript; do
	if [ -x "$root/scripts/verify-$language.sh" ]; then "$root/scripts/verify-$language.sh" "--$mode"; fi
done
step "$mode gate passed"
