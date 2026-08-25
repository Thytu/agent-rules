#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd -P)"
version=22.22.0
os="$(uname -s)"
arch="$(uname -m)"
case "$os-$arch" in
	Darwin-arm64) platform=darwin-arm64; checksum=5ed4db0fcf1eaf84d91ad12462631d73bf4576c1377e192d222e48026a902640 ;;
	Darwin-x86_64) platform=darwin-x64; checksum=5ea50c9d6dea3dfa3abb66b2656f7a4e1c8cef23432b558d45fb538c7b5dedce ;;
	Linux-aarch64) platform=linux-arm64; checksum=25ba95dfb96871fa2ef977f11f95ea90818c8fa15c0f2110771db08d4ba423be ;;
	Linux-x86_64) platform=linux-x64; checksum=c33c39ed9c80deddde77c960d00119918b9e352426fd604ba41638d6526a4744 ;;
	*) echo "setup-typescript: unsupported platform $os-$arch" >&2; exit 1 ;;
esac
archive="node-v${version}-${platform}.tar.gz"
cache="${XDG_CACHE_HOME:-$HOME/.cache}/agent-rules/$archive"
tools="$root/.agent-rules/tools"
target="$tools/node-v$version"
mkdir -p "$(dirname "$cache")" "$tools"
if [ ! -f "$cache" ]; then curl --connect-timeout 10 --max-time 300 -fsSL "https://nodejs.org/dist/v${version}/${archive}" -o "$cache"; fi
if command -v sha256sum >/dev/null; then actual="$(sha256sum "$cache" | cut -d' ' -f1)"; else actual="$(shasum -a 256 "$cache" | cut -d' ' -f1)"; fi
[ "$actual" = "$checksum" ] || { rm -f "$cache"; echo "setup-typescript: Node checksum mismatch" >&2; exit 1; }
if [ ! -x "$target/bin/node" ]; then
	tmp="$(mktemp -d)"
	trap 'rm -rf "$tmp"' EXIT
	tar -xzf "$cache" -C "$tmp"
	rm -rf "$target"
	mv "$tmp/node-v${version}-${platform}" "$target"
fi
ln -sfn "node-v$version" "$tools/node"
export PATH="$tools/node/bin:$PATH"
export COREPACK_HOME="$tools/corepack"
corepack enable --install-directory "$tools/node/bin"
runner="$tools/run-bounded.cjs"
cat > "$runner" <<'JS'
const { spawn } = require("node:child_process");
const [timeout, command, ...args] = process.argv.slice(2);
const child = spawn(command, args, { env: process.env, stdio: "inherit" });
let killTimer;
const timer = setTimeout(() => {
	console.error(`setup-typescript: ${command} exceeded ${timeout}ms`);
	child.kill("SIGTERM");
	killTimer = setTimeout(() => child.kill("SIGKILL"), 5000);
}, Number(timeout));
function clearTimers() {
	clearTimeout(timer);
	if (killTimer) clearTimeout(killTimer);
}
child.on("error", (error) => {
	clearTimers();
	console.error(error.message);
	process.exit(1);
});
child.on("exit", (code) => {
	clearTimers();
	process.exit(code ?? 124);
});
JS
"$tools/node/bin/node" "$runner" 300000 "$tools/node/bin/corepack" prepare pnpm@10.20.0 --activate
cd "$root"
"$tools/node/bin/node" "$runner" 300000 "$tools/node/bin/pnpm" install --frozen-lockfile
