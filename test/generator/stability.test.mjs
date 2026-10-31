import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	chmodSync,
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../template/core/files/scripts/test-stability.sh",
);

// A repository whose stand-in language verifier prints the results of run N
// from a list, so each case controls what every run reports.
function repository(t, runs) {
	const root = mkdtempSync(join(tmpdir(), "agent-rules-stability-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	mkdirSync(join(root, "scripts"));
	copyFileSync(script, join(root, "scripts", "test-stability.sh"));
	runs.forEach((lines, index) =>
		writeFileSync(join(root, `run-${index + 1}`), lines.join("\n")),
	);
	writeFileSync(
		join(root, "scripts", "verify-typescript.sh"),
		`#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd -P)"
count=$(( $(cat "$root/count" 2>/dev/null || echo 0) + 1 ))
echo "$count" > "$root/count"
[ "$1" = --test-results ] || exit 9
[ -s "$root/run-$count" ] || exit 3
cp "$root/run-$count" "$2"
`,
	);
	chmodSync(join(root, "scripts", "verify-typescript.sh"), 0o755);
	const summary = join(root, "summary.md");
	const result = spawnSync(
		"bash",
		[join(root, "scripts", "test-stability.sh")],
		{
			encoding: "utf8",
			env: { ...process.env, GITHUB_STEP_SUMMARY: summary },
		},
	);
	return { result, summary: () => readFileSync(summary, "utf8") };
}

const stable = ["passed\ta > adds", "failed\ta > always broken"];

test("tests with the same outcome in every run pass, consistent failures included", (t) => {
	const { result, summary } = repository(t, [stable, stable, stable]);
	assert.equal(result.status, 0, result.stderr);
	assert.match(
		result.stdout,
		/typescript: 0 of 2 tests changed outcome across 3 runs/,
	);
	assert.match(summary(), /every test produced the same outcome in 3 runs/);
});

test("a test whose outcome changes is reported per run and fails the check", (t) => {
	const flaky = [
		"passed\ta > adds",
		"failed\ta > always broken",
		"failed\ta > races",
	];
	const { result, summary } = repository(t, [
		[...stable, "passed\ta > races"],
		flaky,
		[...stable, "passed\ta > races"],
	]);
	assert.equal(result.status, 1);
	assert.match(
		result.stdout,
		/\| typescript \| `a > races` \| passed \| failed \| passed \|/,
	);
	assert.doesNotMatch(result.stdout, /always broken`/);
	assert.match(summary(), /## Flaky tests/);
});

test("a run that crashes marks its tests absent", (t) => {
	const { result } = repository(t, [stable, [], stable]);
	assert.equal(result.status, 1);
	assert.match(
		result.stdout,
		/\| typescript \| `a > adds` \| passed \| absent \| passed \|/,
	);
});
