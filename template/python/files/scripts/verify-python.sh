#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd -P)"
tools="$root/.agent-rules/tools"
export PATH="$tools/uv:$PATH"
export UV_CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/agent-rules/uv-cache"
export UV_PYTHON_BIN_DIR="$tools/python-bin"
export UV_PYTHON_INSTALL_DIR="$tools/python"
cd "$root"
fail() { echo "verify-python: $*" >&2; exit 1; }
for path in .python-version pyproject.toml uv.lock pylint-shape-boundaries.rc; do [ -f "$path" ] || fail "missing $path"; done
[ -x "$tools/uv/uv" ] || fail "uv is missing; run scripts/setup-python.sh"
[ "$(uv --version | cut -d' ' -f2)" = 0.12.6 ] || fail "uv version mismatch; run scripts/setup-python.sh"
[ "$(uv run --frozen python --version)" = "Python 3.13.13" ] || fail "Python version mismatch; run scripts/setup-python.sh"
uv lock --check
uv run --frozen ruff format --check .
uv run --frozen ruff check .
uv run --frozen pyright
uv run --frozen pylint . --rcfile pylint-shape-boundaries.rc
uv run --frozen deptry .
uv run --frozen pip-audit --local --strict --progress-spinner off
has_tests=false
for directory in test tests; do
	if [ -d "$directory" ] && find "$directory" -type f -name '*.py' -print -quit | grep -q .; then has_tests=true; break; fi
done
[ "$has_tests" = false ] || uv run --frozen pytest
