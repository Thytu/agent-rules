#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f Cargo.toml ] || exit 0

mode="${1:-full}"
case "$mode" in
	fast | full) ;;
	*)
		echo "verify-rust: expected 'fast' or 'full', got '${mode}'." >&2
		exit 2
		;;
esac


for file in Cargo.lock rust-toolchain.toml deny.toml; do
	[ -f "$file" ] || {
		echo "verify-rust: ${file} is required by docs/profiles/rust.md." >&2
		exit 1
	}
done
cargo fmt --all --check
cargo clippy --workspace --all-targets --all-features --locked -- -D warnings

[ "$mode" = fast ] && exit 0

for tool in taplo typos cargo-deny cargo-machete; do
	command -v "$tool" >/dev/null || {
		echo "verify-rust: ${tool} is required; run bash scripts/setup-rust-tools.sh." >&2
		exit 1
	}
done

taplo format --check
taplo lint
typos
cargo test --workspace --all-targets --all-features --locked
cargo test --workspace --all-features --doc --locked
RUSTDOCFLAGS="-D warnings" cargo doc --workspace --all-features --no-deps --locked
cargo deny check
cargo machete
