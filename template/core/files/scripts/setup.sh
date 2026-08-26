#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd -P)"
mode=normal
tools_dir="$root/.agent-rules/tools"

while [ "$#" -gt 0 ]; do
	case "$1" in
		--structure-only) mode=structure ;;
		--tools-dir)
			shift
			[ "$#" -gt 0 ] || { echo "setup: --tools-dir requires a path" >&2; exit 2; }
			tools_dir="$1"
			;;
		*) echo "setup: unknown argument '$1'" >&2; exit 2 ;;
	esac
	shift
done

install_actionlint() {
	local version=1.7.7 os arch archive checksum cache tmp actual
	case "$(uname -s)" in Darwin) os=darwin ;; Linux) os=linux ;; *) echo "setup: unsupported OS" >&2; exit 1 ;; esac
	case "$(uname -m)" in x86_64|amd64) arch=amd64 ;; arm64|aarch64) arch=arm64 ;; *) echo "setup: unsupported architecture" >&2; exit 1 ;; esac
	archive="actionlint_${version}_${os}_${arch}.tar.gz"
	case "$os-$arch" in
		darwin-amd64) checksum=28e5de5a05fc558474f638323d736d822fff183d2d492f0aecb2b73cc44584f5 ;;
		darwin-arm64) checksum=2693315b9093aeacb4ebd91a993fea54fc215057bf0da2659056b4bc033873db ;;
		linux-amd64) checksum=023070a287cd8cccd71515fedc843f1985bf96c436b7effaecce67290e7e0757 ;;
		linux-arm64) checksum=401942f9c24ed71e4fe71b76c7d638f66d8633575c4016efd2977ce7c28317d0 ;;
	esac
	mkdir -p "$tools_dir"
	[ -x "$tools_dir/actionlint" ] && [ "$($tools_dir/actionlint -version)" = "$version" ] && return
	cache="${XDG_CACHE_HOME:-$HOME/.cache}/agent-rules/$archive"
	mkdir -p "$(dirname "$cache")"
	if [ ! -f "$cache" ]; then
		curl --connect-timeout 10 --max-time 300 -fsSL "https://github.com/rhysd/actionlint/releases/download/v${version}/${archive}" -o "$cache"
	fi
	if command -v sha256sum >/dev/null; then actual="$(sha256sum "$cache" | cut -d' ' -f1)"; else actual="$(shasum -a 256 "$cache" | cut -d' ' -f1)"; fi
	[ "$actual" = "$checksum" ] || { rm -f "$cache"; echo "setup: Actionlint checksum mismatch" >&2; exit 1; }
	tmp="$(mktemp -d)"
	trap 'rm -rf "$tmp"' RETURN
	tar -xzf "$cache" -C "$tmp" actionlint
	install -m 0755 "$tmp/actionlint" "$tools_dir/actionlint"
	rm -rf "$tmp"
	trap - RETURN
}

install_actionlint
[ "$mode" = structure ] && exit 0

git -C "$root" config core.hooksPath .githooks
[ -x "$root/scripts/setup-python.sh" ] && "$root/scripts/setup-python.sh"
[ -x "$root/scripts/setup-rust.sh" ] && "$root/scripts/setup-rust.sh"
[ -x "$root/scripts/setup-typescript.sh" ] && "$root/scripts/setup-typescript.sh"

echo "setup: pinned tooling installed; hooks active"
