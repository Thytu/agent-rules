import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	chmodSync,
	cpSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	readlinkSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const isolatedEnvironment = Object.fromEntries(
	Object.entries(globalThis.process.env).filter(
		([name]) =>
			!/(?:TOKEN|SECRET|PASSWORD|CREDENTIAL|API_KEY|ACCESS_KEY|PRIVATE_KEY)/i.test(
				name,
			),
	),
);
const inheritedPath = isolatedEnvironment.PATH ?? "";

function git(root, ...args) {
	return execFileSync(
		"git",
		[
			"-c",
			"user.name=Generator Test",
			"-c",
			"user.email=test@example.com",
			"-C",
			root,
			...args,
		],
		{ encoding: "utf8" },
	).trim();
}

function repository(t, remote = "https://github.com/example/product.git") {
	const temp = mkdtempSync(join(tmpdir(), "agent-rules-init-"));
	t.after(() =>
		rmSync(temp, {
			recursive: true,
			force: true,
			maxRetries: 20,
			retryDelay: 100,
		}),
	);
	const root = join(temp, "repo");
	cpSync(sourceRoot, root, {
		recursive: true,
		verbatimSymlinks: true,
		filter(path) {
			const rel = relative(sourceRoot, path);
			return ![".git", "node_modules", ".agent-rules"].some(
				(entry) => rel === entry || rel.startsWith(`${entry}/`),
			);
		},
	});
	git(root, "init", "-b", "main");
	git(root, "add", ".");
	git(root, "commit", "-qm", "chore: template");
	git(root, "remote", "add", "origin", remote);
	return { root, temp };
}

function runInit(root, mode, extraEnv = {}) {
	return execFileSync(join(root, "init.sh"), [mode], {
		cwd: root,
		encoding: "utf8",
		env: { ...isolatedEnvironment, PATH: inheritedPath, ...extraEnv },
		stdio: isolatedEnvironment.DEBUG_INIT === "1" ? "inherit" : undefined,
	});
}
const liveModes = new Set([
	"python",
	"rust",
	"typescript",
	"python,rust,typescript",
]);

function stubToolBoundaries(root, temp) {
	const bin = join(temp, "tool-bin");
	mkdirSync(bin);
	for (const command of ["taplo", "typos", "cargo-deny", "cargo-machete"]) {
		const path = join(bin, command);
		writeFileSync(path, "#!/usr/bin/env bash\nexit 0\n");
		chmodSync(path, 0o755);
	}
	const cargo = join(bin, "cargo");
	writeFileSync(
		cargo,
		`#!/usr/bin/env bash
case " $* " in *" metadata "*) printf '{"packages":[]}\n' ;; esac
`,
	);
	chmodSync(cargo, 0o755);

	const setup = join(root, "template", "core", "files", "scripts", "setup.sh");
	writeFileSync(
		setup,
		`#!/usr/bin/env bash
set -euo pipefail
if [ "\${1:-}" = "--structure-only" ]; then
  [ "\${2:-}" = "--tools-dir" ]
  tools="\${3:?}"
  mkdir -p "$tools"
  printf '#!/usr/bin/env bash\nexit 0\n' > "$tools/actionlint"
  chmod 0755 "$tools/actionlint"
  exit 0
fi
root="$(cd "$(dirname "$0")/.." && pwd -P)"
tools="$root/.agent-rules/tools"
mkdir -p "$tools/uv" "$tools/node/bin"
cat > "$tools/actionlint" <<'SH'
#!/usr/bin/env bash
exit 0
SH
cat > "$tools/uv/uv" <<'SH'
#!/usr/bin/env bash
case "$*" in
  "--version") printf 'uv 0.12.6\n' ;;
  *" python --version") printf 'Python 3.13.13\n' ;;
esac
SH
cat > "$tools/node/bin/node" <<'SH'
#!/usr/bin/env bash
printf 'v22.22.0\n'
SH
cat > "$tools/node/bin/pnpm" <<'SH'
#!/usr/bin/env bash
if [ "\${1:-}" = "--version" ]; then printf '10.20.0\n'; fi
SH
chmod 0755 "$tools/actionlint" "$tools/uv/uv" "$tools/node/bin/node" "$tools/node/bin/pnpm"
git -C "$root" config core.hooksPath .githooks
`,
	);
	chmodSync(setup, 0o755);
	git(root, "add", ".");
	git(root, "commit", "-qm", "test: stub external tool boundaries");
	return `${bin}:${inheritedPath}`;
}

function paths(root) {
	const result = [];
	function walk(dir) {
		for (const name of readdirSync(dir).sort()) {
			const path = join(dir, name);
			const rel = relative(root, path).split("\\").join("/");
			if (
				rel === ".git" ||
				rel.startsWith(".git/") ||
				rel === "node_modules" ||
				rel.startsWith("node_modules/") ||
				rel === ".agent-rules/tools" ||
				rel === ".venv" ||
				rel.startsWith(".venv/") ||
				rel === ".pytest_cache" ||
				rel.startsWith(".pytest_cache/") ||
				rel === ".ruff_cache" ||
				rel.startsWith(".ruff_cache/") ||
				rel.includes("/__pycache__/") ||
				rel.endsWith("/__pycache__") ||
				rel.startsWith(".agent-rules/tools/") ||
				rel === "target" ||
				rel.startsWith("target/")
			)
				continue;
			result.push(rel + (lstatSync(path).isDirectory() ? "/" : ""));
			if (lstatSync(path).isDirectory()) walk(path);
		}
	}
	walk(root);
	return result;
}

function snapshot(root) {
	const hash = createHash("sha256");
	function walk(dir) {
		for (const name of readdirSync(dir).sort()) {
			if (dir === root && name === ".git") continue;
			const path = join(dir, name);
			const rel = relative(root, path).split("\\").join("/");
			const stat = lstatSync(path);
			hash.update(`${rel}\0${stat.mode.toString(8)}\0`);
			if (stat.isSymbolicLink()) hash.update(readlinkSync(path));
			else if (stat.isFile()) hash.update(readFileSync(path));
			else if (stat.isDirectory()) walk(path);
		}
	}
	walk(root);
	return hash.digest("hex");
}

function exerciseGitHubSetup(root, temp) {
	const bin = join(temp, "github-bin");
	const state = join(temp, "github-state");
	const log = join(temp, "gh.log");
	const gh = join(bin, "gh");
	const alerts = join(state, "vulnerability-alerts");
	const securityFixes = join(state, "automated-security-fixes");
	mkdirSync(bin);
	mkdirSync(state);
	writeFileSync(securityFixes, "enabled\n");
	writeFileSync(
		gh,
		`#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$GH_LOG"
case "$*" in
	"repo view --json nameWithOwner --jq .nameWithOwner") printf 'org/repo\n' ;;
	"api -X PUT repos/org/repo/vulnerability-alerts") printf 'enabled\n' > "$GH_STATE/vulnerability-alerts" ;;
	"api repos/org/repo/rulesets") printf '[]\n' ;;
esac
case " $* " in *" --input - "*) cat >/dev/null ;; esac
`,
	);
	chmodSync(gh, 0o755);
	const options = {
		cwd: root,
		encoding: "utf8",
		env: {
			...isolatedEnvironment,
			GH_LOG: log,
			GH_STATE: state,
			PATH: `${bin}:${inheritedPath}`,
		},
	};
	const initial = execFileSync("bash", ["scripts/setup-github.sh"], options);
	const rerun = execFileSync("bash", ["scripts/setup-github.sh"], options);
	assert.equal(readFileSync(alerts, "utf8"), "enabled\n");
	assert.equal(readFileSync(securityFixes, "utf8"), "enabled\n");
	const calls = readFileSync(log, "utf8");
	assert.doesNotMatch(
		calls,
		/INTEGRATION_OWNER|automated-security-fixes|api user|variable (?:list|set)/,
	);
	assert.match(initial, /security pull-request preference preserved/);
	assert.match(rerun, /security pull-request preference preserved/);
}

for (const mode of [
	"python",
	"rust",
	"typescript",
	"python,rust",
	"python,typescript",
	"rust,typescript",
	"python,rust,typescript",
]) {
	const live = liveModes.has(mode);
	test(`${live ? "materializes and exercises" : "materializes"} ${mode}`, {
		timeout: 20 * 60_000,
	}, (t) => {
		const { root, temp } = repository(t);
		const path = live ? inheritedPath : stubToolBoundaries(root, temp);
		runInit(root, mode, {
			GIT_DIR: join(temp, "wrong.git"),
			GIT_CONFIG_COUNT: "1",
			GIT_CONFIG_KEY_0: "core.worktree",
			GIT_CONFIG_VALUE_0: temp,
			PATH: path,
		});
		assert.equal(lstatSync(join(root, "CLAUDE.md")).isSymbolicLink(), true);
		assert.equal(
			Boolean(mode.includes("rust")),
			lstatSync(join(root, "Cargo.toml"), {
				throwIfNoEntry: false,
			})?.isFile() ?? false,
		);
		assert.equal(
			Boolean(mode.includes("typescript")),
			lstatSync(join(root, "package.json"), {
				throwIfNoEntry: false,
			})?.isFile() ?? false,
		);
		assert.equal(
			Boolean(mode.includes("python")),
			lstatSync(join(root, "pyproject.toml"), {
				throwIfNoEntry: false,
			})?.isFile() ?? false,
		);
		assert.equal(
			lstatSync(join(root, "init.sh"), { throwIfNoEntry: false }),
			undefined,
		);
		assert.equal(
			lstatSync(join(root, ".github", "dependabot.yml"), {
				throwIfNoEntry: false,
			}),
			undefined,
		);
		const agentMap = readFileSync(join(root, "AGENTS.md"), "utf8");
		for (const owner of [
			"authorization-persistence",
			"boundaries",
			"comments",
			"contract-evolution",
			"dependency-integrity",
			"efficiency",
			"lifecycle-capacity",
			"testing",
		])
			assert.match(agentMap, new RegExp(`docs/rules/${owner}\\.md`));
		assert.equal(
			agentMap.includes("Rust implementation"),
			mode.includes("rust"),
		);
		assert.equal(
			agentMap.includes("TypeScript implementation"),
			mode.includes("typescript"),
		);
		assert.equal(
			agentMap.includes("Python implementation"),
			mode.includes("python"),
		);
		assert.doesNotMatch(agentMap, /docs\/profiles|LANGUAGE_ROWS/);
		const pullRequestTemplate = readFileSync(
			join(root, ".github", "PULL_REQUEST_TEMPLATE.md"),
			"utf8",
		);
		assert.match(pullRequestTemplate, /> \*\*Outcome:\*\*/);
		assert.match(
			pullRequestTemplate,
			/\| Surface or contract \| Before \| After \|/,
		);
		assert.match(pullRequestTemplate, /\| Procedure \| Evidence \|/);
		assert.match(pullRequestTemplate, /\| Risk \| Bound \|/);
		exerciseGitHubSetup(root, temp);
		const actual = `${paths(root).join("\n")}\n`;
		const golden = join(
			sourceRoot,
			"test",
			"generator",
			"golden",
			`${mode.replaceAll(",", "-")}.paths`,
		);
		if (isolatedEnvironment.UPDATE_GOLDENS === "1")
			writeFileSync(golden, actual);
		else assert.equal(actual, readFileSync(golden, "utf8"));
		writeFileSync(
			join(root, ".github", "dependabot.yml"),
			"version: 2\nupdates:\n  - package-ecosystem: github-actions\n    directory: /\n    schedule:\n      interval: monthly\n",
		);
		mkdirSync(join(root, "app"), { recursive: true });
		writeFileSync(join(root, "app", "product.txt"), "product-owned\n");
		if (mode === "rust") {
			writeFileSync(
				join(root, "package.json"),
				'{"name":"rust-product-metadata","private":true}\n',
			);
		}
		execFileSync("bash", ["scripts/verify.sh", "--structure-only"], {
			cwd: root,
			env: isolatedEnvironment,
		});
		if (mode === "python") {
			mkdirSync(join(root, "src"), { recursive: true });
			mkdirSync(join(root, "tests"), { recursive: true });
			writeFileSync(
				join(root, "src", "product.py"),
				"from dataclasses import dataclass\n\n\n@dataclass(frozen=True, slots=True)\nclass Product:\n    value: int\n\n\ndef doubled(product: Product) -> int:\n    return product.value * 2\n",
			);
			writeFileSync(
				join(root, "tests", "test_product.py"),
				"from product import Product, doubled\n\n\ndef test_doubled() -> None:\n    assert doubled(Product(value=21)) == 42\n",
			);
			execFileSync("bash", ["scripts/verify.sh"], {
				cwd: root,
				env: isolatedEnvironment,
				stdio: isolatedEnvironment.DEBUG_INIT === "1" ? "inherit" : undefined,
			});
			const invalidPython = join(root, "src", "invalid.py");
			for (const [invalid, message] of [
				[
					'def read_name(value: object) -> str:\n    return getattr(value, "name")\n',
					/B009|TID251|bad-builtin/,
				],
				[
					"from typing import Any\n\n\ndef preserve(value: Any) -> Any:\n    return value\n",
					/TID251|ANN401/,
				],
				[
					'def parse(value: str) -> str:\n    try:\n        return value\n    except Exception:\n        return ""\n',
					/BLE001/,
				],
				[
					"def today() -> str:\n    from datetime import date\n\n    return date.today().isoformat()\n",
					/PLC0415/,
				],
				[
					"from typing import cast\n\n\ndef preserve(value: object) -> str:\n    return cast(str, value)\n",
					/TID251/,
				],
				["def report(value: str) -> None:\n    print(value)\n", /T201/],
				[
					"def pending() -> None:\n    # TODO: implement persistence\n    return None\n",
					/FIX002/,
				],
				[
					"def preserve(value: object) -> object:  # noqa\n    return value\n",
					/PGH004|RUF100/,
				],
				[
					"def classify(value: int) -> int:\n    if value == 0:\n        return 0\n    if value == 1:\n        return 1\n    if value == 2:\n        return 2\n    if value == 3:\n        return 3\n    if value == 4:\n        return 4\n    if value == 5:\n        return 5\n    if value == 6:\n        return 6\n    if value == 7:\n        return 7\n    if value == 8:\n        return 8\n    if value == 9:\n        return 9\n    return value\n",
					/C901|PLR0911/,
				],
			]) {
				writeFileSync(invalidPython, invalid);
				const rejected = spawnSync("bash", ["scripts/verify-python.sh"], {
					cwd: root,
					encoding: "utf8",
					env: isolatedEnvironment,
				});
				assert.notEqual(rejected.status, 0);
				assert.match(`${rejected.stdout}${rejected.stderr}`, message);
			}
			rmSync(invalidPython);
		}
		if (mode === "typescript") {
			mkdirSync(join(root, "test", "product"), { recursive: true });
			writeFileSync(
				join(root, "test", "product", "value.test.ts"),
				'import assert from "node:assert/strict";\nimport { test } from "node:test";\ntest("typed product test", () => {\n\tconst value: number = 2;\n\tassert.equal(value, 2);\n});\n',
			);
			writeFileSync(
				join(root, "test", "product", "view.test.tsx"),
				'import assert from "node:assert/strict";\nimport { test } from "node:test";\ntest("tsx product test", () => {\n\tconst label: string = "ready";\n\tassert.equal(label, "ready");\n});\n',
			);
			writeFileSync(
				join(root, "test", "product", "ignored.test.mjs"),
				'throw new Error("unsupported test extension executed");\n',
			);
			execFileSync("bash", ["scripts/verify.sh"], {
				cwd: root,
				env: isolatedEnvironment,
				stdio: isolatedEnvironment.DEBUG_INIT === "1" ? "inherit" : undefined,
			});
			const objectPrototypeCheck = join(
				root,
				"app",
				"object-prototype-check.ts",
			);
			writeFileSync(
				objectPrototypeCheck,
				'const tag = Object.prototype.toString.call("value");\n',
			);
			const rejected = spawnSync(
				join(root, "node_modules", ".bin", "eslint"),
				["app/object-prototype-check.ts"],
				{ cwd: root, encoding: "utf8", env: isolatedEnvironment },
			);
			assert.notEqual(rejected.status, 0);
			assert.match(
				`${rejected.stdout}${rejected.stderr}`,
				/no-restricted-properties/,
			);
			rmSync(objectPrototypeCheck);
		}
		if (mode === "rust") {
			const cargoPath = join(root, "Cargo.toml");
			writeFileSync(
				cargoPath,
				`${readFileSync(cargoPath, "utf8").replace(
					"members = []",
					'members = ["crates/helper", "crates/product"]',
				)}\n[workspace.dependencies]\nhelper = { path = "crates/helper", version = "0.1.0" }\n`,
			);
			for (const crate of ["helper", "product"])
				mkdirSync(join(root, "crates", crate, "src"), { recursive: true });
			const helperManifest = `[package]\nname = "helper"\nversion.workspace = true\nedition.workspace = true\nrust-version.workspace = true\nlicense.workspace = true\n\n[lints]\nworkspace = true\n`;
			const productManifest = `[package]\nname = "product"\nversion.workspace = true\nedition.workspace = true\nrust-version.workspace = true\nlicense.workspace = true\n\n[lints]\nworkspace = true\n\n[dependencies]\nhelper = { workspace = true }\n`;
			writeFileSync(
				join(root, "crates", "helper", "Cargo.toml"),
				helperManifest,
			);
			writeFileSync(
				join(root, "crates", "helper", "src", "lib.rs"),
				"#[must_use]\npub const fn answer() -> u32 {\n    42\n}\n",
			);
			const productManifestPath = join(root, "crates", "product", "Cargo.toml");
			writeFileSync(productManifestPath, productManifest);
			writeFileSync(
				join(root, "crates", "product", "src", "lib.rs"),
				"#[must_use]\npub const fn answer() -> u32 {\n    helper::answer()\n}\n",
			);
			execFileSync("cargo", ["+1.98.0", "generate-lockfile"], {
				cwd: root,
				env: isolatedEnvironment,
			});
			execFileSync("bash", ["scripts/verify.sh"], {
				cwd: root,
				env: isolatedEnvironment,
				stdio: isolatedEnvironment.DEBUG_INIT === "1" ? "inherit" : undefined,
			});
			for (const [invalid, message] of [
				[
					productManifest.replace(
						"edition.workspace = true",
						'edition = "2024"',
					),
					/must inherit package\.edition/,
				],
				[
					productManifest.replace("[lints]\nworkspace = true\n\n", ""),
					/must set lints\.workspace = true/,
				],
				[
					productManifest.replace(
						"helper = { workspace = true }",
						'helper = { path = "../helper" }',
					),
					/must inherit every dependencies entry/,
				],
			]) {
				writeFileSync(productManifestPath, invalid);
				const rejected = spawnSync("bash", ["scripts/verify-rust.sh"], {
					cwd: root,
					encoding: "utf8",
					env: isolatedEnvironment,
				});
				assert.notEqual(rejected.status, 0);
				assert.match(`${rejected.stdout}${rejected.stderr}`, message);
			}
			writeFileSync(productManifestPath, productManifest);
		}
	});
}

for (const remote of [
	"git@github.com:Thytu/agent-rules.git",
	"ssh://git@github.com/Thytu/agent-rules.git/",
]) {
	test(`rejects canonical source remote ${remote}`, (t) => {
		const { root } = repository(t, remote);
		const before = snapshot(root);
		const result = spawnSync(join(root, "init.sh"), ["rust"], {
			cwd: root,
			encoding: "utf8",
			env: isolatedEnvironment,
		});
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /canonical agent-rules source/);
		assert.equal(snapshot(root), before);
	});
}

const unsafeInputs = [
	{
		name: "invalid selection",
		args: ["go"],
		mutate() {},
		expected: /invalid language selection/,
	},
	{
		name: "non-main branch",
		args: ["rust"],
		mutate(root) {
			git(root, "checkout", "-qb", "feature");
		},
		expected: /branch must be main/,
	},
	{
		name: "modified tracked file",
		args: ["rust"],
		mutate(root) {
			writeFileSync(join(root, "README.md"), "modified\n");
		},
		expected: /tracked files differ from HEAD/,
	},
	{
		name: "staged change",
		args: ["rust"],
		mutate(root) {
			writeFileSync(join(root, "README.md"), "staged\n");
			git(root, "add", "README.md");
		},
		expected: /index differs from HEAD/,
	},
	{
		name: "ordinary untracked file",
		args: ["rust"],
		mutate(root) {
			writeFileSync(join(root, "extra.txt"), "extra\n");
		},
		expected: /untracked or ignored entries/,
	},
	{
		name: "ignored secret",
		args: ["rust"],
		mutate(root) {
			mkdirSync(join(root, ".agent-rules", "tools"), { recursive: true });
			writeFileSync(join(root, ".agent-rules", "tools", "secret"), "secret\n");
		},
		expected: /untracked or ignored entries/,
	},
	{
		name: "untracked empty directory",
		args: ["rust"],
		mutate(root) {
			mkdirSync(join(root, "empty-directory"));
		},
		expected: /untracked empty directory/,
	},
];

for (const fixture of unsafeInputs) {
	test(`rejects ${fixture.name} without mutation`, (t) => {
		const { root } = repository(t);
		fixture.mutate(root);
		const before = snapshot(root);
		const result = spawnSync(join(root, "init.sh"), fixture.args, {
			cwd: root,
			encoding: "utf8",
			env: isolatedEnvironment,
		});
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, fixture.expected);
		assert.equal(snapshot(root), before);
	});
}

test("rejects an overlay collision before replacement", (t) => {
	const { root } = repository(t);
	writeFileSync(
		join(root, "template", "rust", "files", "README.md"),
		"collision\n",
	);
	git(root, "add", ".");
	git(root, "commit", "-qm", "test: collision fixture");
	const before = snapshot(root);
	const result = spawnSync(join(root, "init.sh"), ["rust"], {
		cwd: root,
		encoding: "utf8",
		env: isolatedEnvironment,
	});
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /overlay collision at README\.md/);
	assert.equal(snapshot(root), before);
});

test("restores bytes modes and symlinks when post-copy verification fails", {
	timeout: 120_000,
}, (t) => {
	const { root, temp } = repository(t);
	const bin = join(temp, "bin");
	mkdirSync(bin);
	const fakeDiff = join(bin, "diff");
	writeFileSync(fakeDiff, "#!/usr/bin/env bash\nexit 1\n");
	chmodSync(fakeDiff, 0o755);
	const before = snapshot(root);
	const result = spawnSync(join(root, "init.sh"), ["typescript"], {
		cwd: root,
		encoding: "utf8",
		env: { ...isolatedEnvironment, PATH: `${bin}:${inheritedPath}` },
	});
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /original checkout restored/);
	assert.equal(snapshot(root), before);
});

test("restores checkout and Git config when normal setup fails", {
	timeout: 5 * 60_000,
}, (t) => {
	const { root } = repository(t);
	const setup = join(root, "template", "core", "files", "scripts", "setup.sh");
	writeFileSync(
		setup,
		`${readFileSync(setup, "utf8")}\nif [ "\${1:-}" != "--structure-only" ]; then exit 73; fi\n`,
	);
	git(root, "add", ".");
	git(root, "commit", "-qm", "test: normal setup failure fixture");
	const before = snapshot(root);
	const configBefore = readFileSync(join(root, ".git", "config"));
	const result = spawnSync(join(root, "init.sh"), ["rust"], {
		cwd: root,
		encoding: "utf8",
		env: isolatedEnvironment,
	});
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /original checkout restored/);
	assert.equal(snapshot(root), before);
	assert.deepEqual(readFileSync(join(root, ".git", "config")), configBefore);
});
