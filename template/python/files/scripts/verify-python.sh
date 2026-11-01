#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd -P)"
. "$root/scripts/verify-mode.sh" verify-python "$@"
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

has_python() { [ -d "$1" ] && find "$1" -type f -name '*.py' -print -quit | grep -q .; }
has_source=false
has_tests=false
! has_python src || has_source=true
for directory in test tests; do ! has_python "$directory" || has_tests=true; done

uv lock --check
uv run --frozen ruff format --check .
uv run --frozen ruff check .
uv run --frozen pyright
uv run --frozen pylint . --rcfile pylint-shape-boundaries.rc
uv run --frozen deptry .
if [ "$mode" = full ] || ! git diff --cached --quiet -- pyproject.toml uv.lock; then
	uv run --frozen pip-audit --local --strict --progress-spinner off
else
	echo "verify-python: advisory audit skipped because no dependency change is staged; the push and CI gates run it"
fi
if [ "$has_source" = true ] && [ "$has_tests" = false ]; then
	fail "src/ has Python code but test/ and tests/ have no tests; coverage floors apply to all of src/"
fi
# Coverage counts every module under src/, imported by a test or not; the
# floor lives in pyproject.toml under [tool.coverage.report].
[ "$has_tests" = false ] || uv run --frozen pytest --cov --cov-report=term-missing:skip-covered
