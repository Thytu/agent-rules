#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd -P)"
cd "$root"
for path in Cargo.toml Cargo.lock rust-toolchain.toml rustfmt.toml clippy.toml deny.toml .cargo/config.toml; do [ -f "$path" ] || { echo "verify-rust: missing $path" >&2; exit 1; }; done
for tool in taplo typos cargo-deny cargo-machete; do command -v "$tool" >/dev/null || { echo "verify-rust: missing $tool; run scripts/setup-rust.sh" >&2; exit 1; }; done
metadata="$(mktemp)"
trap 'rm -f "$metadata"' EXIT
cargo +1.98.0 metadata --format-version 1 --no-deps --locked > "$metadata"
toml=(Cargo.toml .cargo/config.toml clippy.toml deny.toml rust-toolchain.toml rustfmt.toml)
taplo format --check "${toml[@]}"
taplo lint "${toml[@]}"
typos --exclude '.agent-rules/**' --exclude 'node_modules/**' --exclude 'target/**'
if grep -q '"packages":\[\]' "$metadata"; then
	echo "verify-rust: empty workspace policy is valid; package gates activate with the first real crate"
	exit 0
fi
cargo +1.98.0 deny check
cargo +1.98.0 fmt --all --check
cargo +1.98.0 clippy --workspace --all-targets --all-features --locked -- -D warnings
cargo +1.98.0 test --workspace --all-targets --all-features --locked
cargo +1.98.0 test --workspace --all-features --doc --locked
RUSTDOCFLAGS='-D warnings' cargo +1.98.0 doc --workspace --all-features --no-deps --locked
cargo machete
