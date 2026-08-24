#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd -P)"
tools="$root/.agent-rules/tools"
export PATH="$tools/node/bin:$PATH"
unset NODE_TEST_CONTEXT
export COREPACK_HOME="$tools/corepack"
[ "$(node --version)" = v22.22.0 ] || { echo "verify-typescript: run scripts/setup-typescript.sh" >&2; exit 1; }
[ "$(pnpm --version)" = 10.20.0 ] || { echo "verify-typescript: pnpm version mismatch" >&2; exit 1; }
cd "$root"
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run audit
pnpm run unused
