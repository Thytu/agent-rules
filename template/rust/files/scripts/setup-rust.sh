#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd -P)"
cd "$root"
export RUSTUP_DOWNLOAD_TIMEOUT=300
export CARGO_HTTP_TIMEOUT=300
export CARGO_NET_RETRY=2
command -v rustup >/dev/null || { echo "setup-rust: rustup is required" >&2; exit 1; }
rustup toolchain install 1.98.0 --profile minimal --component clippy,rustfmt
for spec in 'cargo-deny 0.20.2' 'cargo-machete 0.9.2' 'taplo-cli 0.10.0' 'typos-cli 1.49.0'; do
	package="${spec% *}"
	version="${spec##* }"
	cargo +1.98.0 install --locked "$package" --version "$version"
done
