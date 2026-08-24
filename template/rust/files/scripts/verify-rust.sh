#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd -P)"
cd "$root"
fail() { echo "verify-rust: $*" >&2; exit 1; }
for path in Cargo.toml Cargo.lock rust-toolchain.toml rustfmt.toml clippy.toml deny.toml .cargo/config.toml; do [ -f "$path" ] || fail "missing $path"; done
for tool in taplo typos cargo-deny cargo-machete; do command -v "$tool" >/dev/null || fail "missing $tool; run scripts/setup-rust.sh"; done

metadata="$(mktemp)"
trap 'rm -f "$metadata"' EXIT
cargo +1.98.0 metadata --format-version 1 --no-deps --locked > "$metadata"

toml=(Cargo.toml .cargo/config.toml clippy.toml deny.toml rust-toolchain.toml rustfmt.toml)
if grep -q '"packages":\[\]' "$metadata"; then
	taplo format --check "${toml[@]}"
	taplo lint "${toml[@]}"
	typos --exclude '.agent-rules/**' --exclude 'node_modules/**' --exclude 'target/**'
	echo "verify-rust: empty workspace policy is valid; package gates activate with the first real crate"
	exit 0
fi

manifests=()
while IFS= read -r manifest; do manifests+=("$manifest"); done < <(grep -o '"manifest_path":"[^"]*"' "$metadata" | sed 's/^"manifest_path":"//; s/"$//')
for manifest in "${manifests[@]}"; do [ "$manifest" = "$root/Cargo.toml" ] || toml+=("$manifest"); done
taplo format --check "${toml[@]}"
taplo lint "${toml[@]}"
typos --exclude '.agent-rules/**' --exclude 'node_modules/**' --exclude 'target/**'

package_keys=()
while IFS= read -r key; do package_keys+=("$key"); done < <(
	taplo get -o toml -f Cargo.toml workspace.package |
		sed -n 's/^\([A-Za-z0-9_-][A-Za-z0-9_-]*\)[[:space:]]*=.*/\1/p'
)

for manifest in "${manifests[@]}"; do
	relative="${manifest#$root/}"
	for key in "${package_keys[@]}"; do
		value="$(taplo get -s -f "$manifest" "package.$key.workspace" 2>/dev/null || true)"
		[ "$value" = true ] || fail "$relative must inherit package.$key from workspace.package"
	done
	value="$(taplo get -s -f "$manifest" lints.workspace 2>/dev/null || true)"
	[ "$value" = true ] || fail "$relative must set lints.workspace = true"

	while IFS= read -r section; do
		case "$section" in
			dependencies|dev-dependencies|build-dependencies|target.*.dependencies|target.*.dev-dependencies|target.*.build-dependencies) ;;
			*) continue ;;
		esac
		total="$(
			taplo get -o toml -f "$manifest" "$section" |
				awk 'BEGIN { nested = 0 } /^\[/ { count++; nested = 1; next } !nested && /^[^#[:space:]][^=]*=/ { count++ } END { print count + 0 }'
		)"
		inherited="$(
			{ taplo get -o value -f "$manifest" "$section.*.workspace" 2>/dev/null || true; } |
				awk '$0 == "true" { count++ } END { print count + 0 }'
		)"
		[ "$inherited" -eq "$total" ] || fail "$relative must inherit every $section entry from workspace.dependencies"
	done < <(sed -n 's/^\[\([^]]*\)\][[:space:]]*$/\1/p' "$manifest")
done

cargo +1.98.0 deny check
cargo +1.98.0 fmt --all --check
cargo +1.98.0 clippy --workspace --all-targets --all-features --locked -- -D warnings
cargo +1.98.0 test --workspace --all-targets --all-features --locked
cargo +1.98.0 test --workspace --all-features --doc --locked
RUSTDOCFLAGS='-D warnings' cargo +1.98.0 doc --workspace --all-features --no-deps --locked
cargo machete
