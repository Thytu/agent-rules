#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd -P)"
exec bash "$root/template/core/files/scripts/setup-github.sh"
