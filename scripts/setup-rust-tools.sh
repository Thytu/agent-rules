#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f Cargo.toml ] || {
	echo "setup-rust-tools: Cargo.toml is required." >&2
	exit 1
}

tools=(
	"cargo-deny 0.20.2"
	"cargo-machete 0.9.2"
	"taplo-cli 0.10.0"
	"typos-cli 1.49.0"
)

for spec in "${tools[@]}"; do
	package="${spec% *}"
	version="${spec##* }"
	echo "installing ${package} ${version}"
	cargo install --locked "$package" --version "$version"
done
