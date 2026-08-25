#!/usr/bin/env bash
set -euo pipefail
mode="${1:?usage: guard-append-only.sh amend|rebase|force-push}"
shift
case "$mode" in
	amend)
		if [ "${1:-}" = commit ] && [ "${2:-}" = HEAD ]; then echo "commit --amend is blocked; append a new commit" >&2; exit 1; fi
		;;
	rebase)
		echo "rebase is blocked; merge main into the branch" >&2
		exit 1
		;;
	force-push)
		zero=0000000000000000000000000000000000000000
		while read -r _local_ref local_sha remote_ref remote_sha; do
			[ "$remote_sha" = "$zero" ] && continue
			[ "$local_sha" = "$zero" ] && continue
			git merge-base --is-ancestor "$remote_sha" "$local_sha" 2>/dev/null || { echo "push to $remote_ref is not append-only" >&2; exit 1; }
		done
		;;
	*) echo "guard-append-only: unknown mode $mode" >&2; exit 2 ;;
esac
exit 0
