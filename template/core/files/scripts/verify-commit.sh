#!/usr/bin/env bash
set -euo pipefail

# The commit gate verifies exactly the tree Git is about to commit. Anything
# outside the index could make a check pass for code that is not committed, so
# unstaged and untracked changes stop the commit before verification starts.
root="$(git rev-parse --show-toplevel)"
cd "$root"

unstaged=()
untracked=()
scan_worktree() {
	local path
	unstaged=()
	untracked=()
	while IFS= read -r -d '' path; do unstaged+=("$path"); done < <(git diff --name-only -z --ignore-submodules=none)
	while IFS= read -r -d '' path; do untracked+=("$path"); done < <(git ls-files --others --exclude-standard -z)
}

list() {
	echo "commit gate: $1" >&2
	shift
	printf '  %s\n' "$@" >&2
}

scan_worktree
if [ "${#unstaged[@]}" -gt 0 ] || [ "${#untracked[@]}" -gt 0 ]; then
	[ "${#unstaged[@]}" -eq 0 ] || list "these tracked files have unstaged changes:" "${unstaged[@]}"
	[ "${#untracked[@]}" -eq 0 ] || list "these files are untracked and not ignored:" "${untracked[@]}"
	echo "The gate verifies only the staged tree, so files beside the commit could hide a failure." >&2
	echo "Stage them with git add, or set them aside with: git stash push --keep-index --include-untracked" >&2
	echo "Then commit again." >&2
	exit 1
fi

tree="$(git write-tree)"
started="$(date +%s)"
bash "$root/scripts/verify.sh" --commit
scan_worktree
if [ "${#unstaged[@]}" -gt 0 ] || [ "${#untracked[@]}" -gt 0 ] || [ "$(git write-tree)" != "$tree" ]; then
	[ "${#unstaged[@]}" -eq 0 ] || list "a check modified these files while it ran:" "${unstaged[@]}"
	[ "${#untracked[@]}" -eq 0 ] || list "a check created these files while it ran:" "${untracked[@]}"
	echo "commit gate: the verified tree no longer matches the commit; review the changes, stage or remove them, and commit again" >&2
	exit 1
fi
echo "commit gate: passed in $(($(date +%s) - started))s"
