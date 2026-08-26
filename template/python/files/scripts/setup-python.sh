#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd -P)"
uv_version=0.12.6
python_version=3.13.13
os="$(uname -s)"
arch="$(uname -m)"
case "$os-$arch" in
	Darwin-arm64) platform=aarch64-apple-darwin; checksum=14b459d51ea2e71eeba28c45a268c922bdf8607fc6455e3f40b4e082895d160d ;;
	Darwin-x86_64) platform=x86_64-apple-darwin; checksum=2a26ea71bbeff1c7e12c2cc40245c96a041deff276bc921e7038e304d5d3e04c ;;
	Linux-aarch64) platform=aarch64-unknown-linux-gnu; checksum=d58030acd26159499ac82f32da12d1b3c12a3a1bfc414232d9082070c03e128d ;;
	Linux-x86_64) platform=x86_64-unknown-linux-gnu; checksum=8681d8921e7d520fb368991dcf5f9c1905b80f5bf2a265a0ed085c8d8e342477 ;;
	*) echo "setup-python: unsupported platform $os-$arch" >&2; exit 1 ;;
esac
archive="uv-${platform}.tar.gz"
cache="${XDG_CACHE_HOME:-$HOME/.cache}/agent-rules/uv-${uv_version}-${archive}"
tools="$root/.agent-rules/tools"
target="$tools/uv-$uv_version"
mkdir -p "$(dirname "$cache")" "$tools"
if [ ! -f "$cache" ]; then curl --connect-timeout 10 --max-time 300 -fsSL "https://github.com/astral-sh/uv/releases/download/${uv_version}/${archive}" -o "$cache"; fi
if command -v sha256sum >/dev/null; then actual="$(sha256sum "$cache" | cut -d' ' -f1)"; else actual="$(shasum -a 256 "$cache" | cut -d' ' -f1)"; fi
[ "$actual" = "$checksum" ] || { rm -f "$cache"; echo "setup-python: uv checksum mismatch" >&2; exit 1; }
if [ ! -x "$target/uv" ]; then
	tmp="$(mktemp -d)"
	trap 'rm -rf "$tmp"' EXIT
	tar -xzf "$cache" -C "$tmp"
	rm -rf "$target"
	mkdir -p "$target"
	install -m 0755 "$tmp/uv-${platform}/uv" "$target/uv"
fi
ln -sfn "uv-$uv_version" "$tools/uv"
export PATH="$tools/uv:$PATH"
export UV_CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/agent-rules/uv-cache"
export UV_PYTHON_BIN_DIR="$tools/python-bin"
export UV_PYTHON_INSTALL_DIR="$tools/python"
cd "$root"
uv sync --frozen --managed-python --python "$python_version"
