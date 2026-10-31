#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd -P)"
. "$root/scripts/verify-mode.sh" verify-typescript "$@"
tools="$root/.agent-rules/tools"
export PATH="$tools/node/bin:$PATH"
unset NODE_TEST_CONTEXT
export COREPACK_HOME="$tools/corepack"
# agent-rules:addon-env
[ "$(node --version)" = v22.22.0 ] || { echo "verify-typescript: run scripts/setup-typescript.sh" >&2; exit 1; }
[ "$(pnpm --version)" = 10.20.0 ] || { echo "verify-typescript: pnpm version mismatch" >&2; exit 1; }
cd "$root"

if [ "$mode" = results ]; then
	pnpm --silent run test:results > "$results"
	exit 0
fi

# A commit runs the advisory audit only when it changes dependencies: an
# advisory published for an unchanged lockfile is not caused by the commit, and
# the push and CI gates still run the audit on every change.
dependencies_staged() {
	! git diff --cached --quiet -- package.json pnpm-lock.yaml .npmrc
}

pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run test
# agent-rules:addon-checks
pnpm run unused
if [ "$mode" = full ] || dependencies_staged; then
	pnpm run audit
else
	echo "verify-typescript: advisory audit skipped because no dependency change is staged; the push and CI gates run it"
fi
# agent-rules:addon-full-checks
