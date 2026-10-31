#!/usr/bin/env bash
set -euo pipefail

# One lockfile pins the TypeScript base and every add-on together; init prunes
# it to the selected add-ons. `--check` (the source gate) fails when the
# superset manifest or the lockfile is stale, or the lock has a high advisory.
root="$(cd "$(dirname "$0")/.." && pwd -P)"
lock="$root/template/typescript/lock"
mode="${1:---update}"
case "$mode" in --update | --check) ;; *) echo "template-lock: expected --update or --check" >&2; exit 2 ;; esac
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

node "$root/template/init/compose.mjs" superset "$root/template" "$tmp/package.json"
if [ "$mode" = --update ]; then
	mkdir -p "$lock"
	cp "$tmp/package.json" "$lock/package.json"
	cp "$root/template/typescript/files/.npmrc" "$lock/.npmrc"
	(cd "$lock" && pnpm install --lockfile-only --ignore-scripts)
	echo "template-lock: updated template/typescript/lock"
	exit 0
fi

cmp -s "$tmp/package.json" "$lock/package.json" || { echo "template-lock: the superset manifest is stale; run pnpm template:lock" >&2; exit 1; }
cmp -s "$root/template/typescript/files/.npmrc" "$lock/.npmrc" || { echo "template-lock: template/typescript/lock/.npmrc differs from the TypeScript template; run pnpm template:lock" >&2; exit 1; }
(cd "$lock" && pnpm install --lockfile-only --frozen-lockfile --ignore-scripts > "$tmp/install.log" 2>&1) || { cat "$tmp/install.log" >&2; echo "template-lock: the lockfile does not match the superset manifest; run pnpm template:lock" >&2; exit 1; }
(cd "$lock" && pnpm audit --audit-level high)
echo "template-lock: the superset lockfile is current and has no high-severity advisory"
