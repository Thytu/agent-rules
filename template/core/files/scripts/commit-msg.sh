#!/usr/bin/env bash
set -euo pipefail
file="${1:?usage: commit-msg.sh <message-file>}"
header="$(sed -n '1p' "$file")"
[ "${#header}" -le 100 ] || { echo "commit header exceeds 100 characters" >&2; exit 1; }
case "$header" in Merge\ *|Revert\ \"*\") exit 0 ;; esac
printf '%s\n' "$header" | grep -Eq '^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9._/-]+\))?(!)?: .+$' || {
	echo "commit message must be Conventional Commit type(scope)!: description" >&2
	exit 1
}
