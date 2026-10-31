#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd -P)"
mode=normal
only=
tools_dir="$root/.agent-rules/tools"

while [ "$#" -gt 0 ]; do
	case "$1" in
		--structure-only) mode=structure ;;
		--tool)
			shift
			case "${1:-}" in actionlint|gitleaks|jscpd) only="$1" ;; *) echo "setup: --tool requires actionlint, gitleaks, or jscpd" >&2; exit 2 ;; esac
			;;
		--tools-dir)
			shift
			[ "$#" -gt 0 ] || { echo "setup: --tools-dir requires a path" >&2; exit 2; }
			tools_dir="$1"
			;;
		*) echo "setup: unknown argument '$1'" >&2; exit 2 ;;
	esac
	shift
done

case "$(uname -s)" in Darwin) os=darwin ;; Linux) os=linux ;; *) echo "setup: unsupported OS $(uname -s)" >&2; exit 1 ;; esac
case "$(uname -m)" in x86_64|amd64) arch=amd64 ;; arm64|aarch64) arch=arm64 ;; *) echo "setup: unsupported architecture $(uname -m)" >&2; exit 1 ;; esac

# install_tool NAME VERSION URL SHA256 MEMBER: download a release archive once
# into the shared cache, verify its checksum, and expose MEMBER as
# $tools_dir/NAME through a versioned directory.
install_tool() {
	local name="$1" version="$2" url="$3" checksum="$4" member="$5" target cache actual tmp
	target="$tools_dir/$name-$version"
	mkdir -p "$tools_dir"
	if [ ! -x "$target/$name" ]; then
		cache="${XDG_CACHE_HOME:-$HOME/.cache}/agent-rules/${url##*/}"
		case "$cache" in *"-$version"*|*"_$version"*) ;; *) cache="${cache%.tar.gz}-$version.tar.gz" ;; esac
		mkdir -p "$(dirname "$cache")"
		if [ ! -f "$cache" ]; then
			echo "setup: downloading $name $version"
			# A unique partial file keeps concurrent setups from sharing one download.
			curl --connect-timeout 10 --max-time 300 -fsSL "$url" -o "$cache.partial.$$"
			mv "$cache.partial.$$" "$cache"
		fi
		if command -v sha256sum >/dev/null; then actual="$(sha256sum "$cache" | cut -d' ' -f1)"; else actual="$(shasum -a 256 "$cache" | cut -d' ' -f1)"; fi
		[ "$actual" = "$checksum" ] || { rm -f "$cache"; echo "setup: $name $version checksum mismatch; the cached download was removed, run setup again" >&2; exit 1; }
		tmp="$(mktemp -d "$tools_dir/.unpack.XXXXXX")"
		trap 'rm -rf "$tmp"' EXIT
		tar -xzf "$cache" -C "$tmp" "$member"
		rm -rf "$target"
		mkdir -p "$target"
		install -m 0755 "$tmp/$member" "$target/$name"
		rm -rf "$tmp"
		trap - EXIT
	fi
	rm -f "$tools_dir/$name"
	ln -s "$name-$version/$name" "$tools_dir/$name"
}

install_actionlint() {
	local version=1.7.7 checksum
	case "$os-$arch" in
		darwin-amd64) checksum=28e5de5a05fc558474f638323d736d822fff183d2d492f0aecb2b73cc44584f5 ;;
		darwin-arm64) checksum=2693315b9093aeacb4ebd91a993fea54fc215057bf0da2659056b4bc033873db ;;
		linux-amd64) checksum=023070a287cd8cccd71515fedc843f1985bf96c436b7effaecce67290e7e0757 ;;
		linux-arm64) checksum=401942f9c24ed71e4fe71b76c7d638f66d8633575c4016efd2977ce7c28317d0 ;;
	esac
	install_tool actionlint "$version" "https://github.com/rhysd/actionlint/releases/download/v$version/actionlint_${version}_${os}_${arch}.tar.gz" "$checksum" actionlint
}

install_gitleaks() {
	local version=8.30.1 platform checksum
	case "$os-$arch" in
		darwin-amd64) platform=darwin_x64; checksum=dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709 ;;
		darwin-arm64) platform=darwin_arm64; checksum=b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5 ;;
		linux-amd64) platform=linux_x64; checksum=551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb ;;
		linux-arm64) platform=linux_arm64; checksum=e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080 ;;
	esac
	install_tool gitleaks "$version" "https://github.com/gitleaks/gitleaks/releases/download/v$version/gitleaks_${version}_${platform}.tar.gz" "$checksum" gitleaks
}

install_jscpd() {
	local version=5.4.2 platform checksum
	case "$os-$arch" in
		darwin-amd64) platform=darwin-x64; checksum=ae8d24aba2719df7682b1bb2c5021ab096116b8240c45fdae88654fc1ff36b17 ;;
		darwin-arm64) platform=darwin-arm64; checksum=b51d22d7c7610d27d8fd022577021ff3266a10f13295a2e545a8b8e126133a88 ;;
		linux-amd64) platform=linux-x64-gnu; checksum=216bae5de2b30c57f893286585c7a348e8af7cd36810949831f569d29f495a3b ;;
		linux-arm64) platform=linux-arm64-gnu; checksum=f796d57334c34e9361575588ee130f8b0a00388e7e42f3b27f7d50d4aecf85ae ;;
	esac
	install_tool jscpd "$version" "https://github.com/kucherenko/jscpd/releases/download/v$version/jscpd-$platform.tar.gz" "$checksum" jscpd
}

if [ -n "$only" ]; then "install_$only"; exit 0; fi
install_actionlint
[ "$mode" = structure ] && exit 0

install_gitleaks
install_jscpd
git -C "$root" config core.hooksPath .githooks
[ -x "$root/scripts/setup-python.sh" ] && "$root/scripts/setup-python.sh"
[ -x "$root/scripts/setup-rust.sh" ] && "$root/scripts/setup-rust.sh"
[ -x "$root/scripts/setup-typescript.sh" ] && "$root/scripts/setup-typescript.sh"

echo "setup: pinned tooling installed; hooks active"
