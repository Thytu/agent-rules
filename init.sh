#!/usr/bin/env bash
set -euo pipefail

selection="${1:-}"
[ "$#" -eq 1 ] || { echo "usage: ./init.sh rust|typescript|rust,typescript" >&2; exit 2; }
case "$selection" in rust|typescript|rust,typescript) ;; *) echo "init: expected rust, typescript, or rust,typescript" >&2; exit 2 ;; esac

while IFS='=' read -r name _value; do case "$name" in GIT_*) unset "$name" ;; esac; done < <(env)
export GIT_CONFIG_NOSYSTEM=1
export GIT_CONFIG_GLOBAL=/dev/null
root="$(cd "$(dirname "$0")" && pwd -P)"
git_cmd() { git -c core.fsmonitor=false -c protocol.ext.allow=never -C "$root" "$@"; }

toplevel="$(git_cmd rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$toplevel" ] && [ "$(cd "$toplevel" && pwd -P)" = "$root" ] || { echo "init: run from the root of its own Git repository" >&2; exit 1; }
[ "$(git_cmd branch --show-current)" = main ] || { echo "init: branch must be main" >&2; exit 1; }
origin="$(git_cmd remote get-url origin 2>/dev/null || true)"
normalized="$(printf '%s' "$origin" | tr '[:upper:]' '[:lower:]' | sed -E 's#/*$##; s#\.git$##; s#/*$##')"
case "$normalized" in *github.com[:/]thytu/agent-rules) echo "init: canonical agent-rules source cannot materialize itself" >&2; exit 1 ;; esac
git_cmd diff --quiet || { echo "init: tracked files differ from HEAD" >&2; exit 1; }
git_cmd diff --cached --quiet || { echo "init: index differs from HEAD" >&2; exit 1; }
status="$(git_cmd status --porcelain=v1 --untracked-files=all --ignored)"
[ -z "$status" ] || { echo "init: checkout contains untracked or ignored entries" >&2; printf '%s\n' "$status" >&2; exit 1; }
empty_dir="$(find "$root" -path "$root/.git" -prune -o -type d -empty -print -quit)"
[ -z "$empty_dir" ] || { echo "init: checkout contains untracked empty directory ${empty_dir#$root/}" >&2; exit 1; }

tmp="$(mktemp -d "${TMPDIR:-/tmp}/agent-rules-init.XXXXXX")"
out="$tmp/output"
tools="$tmp/tools"
backup="$tmp/backup"
mkdir -p "$out" "$tools" "$backup"
cleanup() { rm -rf "$tmp"; }
trap cleanup EXIT

copy_tree() {
	local source="$1" destination="$2" entry rel
	[ -d "$source" ] || { echo "init: missing overlay $source" >&2; exit 1; }
	while IFS= read -r -d '' entry; do
		rel="${entry#$source/}"
		if [ -d "$entry" ] && [ -d "$destination/$rel" ]; then continue; fi
		if [ -e "$destination/$rel" ] || [ -L "$destination/$rel" ]; then echo "init: overlay collision at $rel" >&2; exit 1; fi
	done < <(find "$source" -mindepth 1 -print0)
	mkdir -p "$destination"
	cp -a "$source/." "$destination/"
}

copy_tree "$root/template/core/files" "$out"
mkdir -p "$out/docs/rules" "$out/docs/profiles"
cp -a "$root/docs/rules/." "$out/docs/rules/"
fragments=("$root/template/core/gitignore.entries")

if [[ ",$selection," == *,rust,* ]]; then
	copy_tree "$root/template/rust/files" "$out"
	cp -a "$root/docs/profiles/rust.md" "$out/docs/profiles/rust.md"
	fragments+=("$root/template/rust/gitignore.entries")
fi
if [[ ",$selection," == *,typescript,* ]]; then
	copy_tree "$root/template/typescript/files" "$out"
	copy_tree "$root/tooling/eslint-rules" "$out/tooling/eslint-rules"
	copy_tree "$root/test/eslint" "$out/test/eslint"
	cp -a "$root/docs/profiles/typescript.md" "$out/docs/profiles/typescript.md"
	fragments+=("$root/template/typescript/gitignore.entries")
fi

awk '!seen[$0]++' "${fragments[@]}" > "$out/.gitignore"

"$out/scripts/setup.sh" --structure-only --tools-dir "$tools"
ACTIONLINT_BIN="$tools/actionlint" "$out/scripts/verify.sh" --structure-only

shopt -s dotglob nullglob
for entry in "$root"/*; do
	[ "$(basename "$entry")" = .git ] && continue
	cp -a "$entry" "$backup/"
done
shopt -u dotglob nullglob
cp -p "$root/.git/config" "$tmp/git-config"

rollback() {
	trap - ERR INT TERM
	shopt -s dotglob nullglob
	for entry in "$root"/*; do [ "$(basename "$entry")" = .git ] || rm -rf "$entry"; done
	for entry in "$backup"/*; do cp -a "$entry" "$root/"; done
	cp -p "$tmp/git-config" "$root/.git/config"
	shopt -u dotglob nullglob
	echo "init: replacement failed; original checkout restored" >&2
}
trap rollback ERR INT TERM
shopt -s dotglob nullglob
for entry in "$root"/*; do [ "$(basename "$entry")" = .git ] || rm -rf "$entry"; done
cp -a "$out/." "$root/"
shopt -u dotglob nullglob
diff -qr -x .git "$out" "$root" >/dev/null

"$root/scripts/setup.sh"
"$root/scripts/verify.sh" --structure-only
[ -x "$root/scripts/verify-rust.sh" ] && "$root/scripts/verify-rust.sh"
[ -x "$root/scripts/verify-typescript.sh" ] && "$root/scripts/verify-typescript.sh"
trap - ERR INT TERM

echo "init: materialized $selection successfully"
echo "next: fill SCOPE.md, VERIFICATION.md, and docs/scenarios; then run bash scripts/verify.sh"
