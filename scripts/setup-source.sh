#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd -P)"
[ "$(node --version 2>/dev/null || true)" = v22.22.0 ] || { echo "setup-source: Node 22.22.0 is required" >&2; exit 1; }
[ "$(pnpm --version 2>/dev/null || true)" = 10.20.0 ] || { echo "setup-source: pnpm 10.20.0 is required (Corepack)" >&2; exit 1; }
bash "$root/template/core/files/scripts/setup.sh" --structure-only --tools-dir "$root/.agent-rules/tools"
git -C "$root" config core.hooksPath .githooks
cd "$root"
pnpm install --frozen-lockfile
echo "setup-source: source dependencies, Actionlint, and hooks ready"
