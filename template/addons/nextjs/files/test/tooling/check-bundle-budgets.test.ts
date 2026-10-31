import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { type TestContext, test } from "node:test";

const script = path.resolve("tooling/check-bundle-budgets.mjs");
const budgets = {
	defaultRoute: { maxBytes: 1000, maxCompressedBytes: 500 },
	routes: {},
	defaultPackageMaxBytes: 100,
	packages: { next: 800 },
};

// Writes analyzer output shaped like `pnpm bundle:analyze` into a scratch
// project directory and returns it.
function project(
	context: TestContext,
	{ routeBytes = 900, nextBytes = 700, routeCount = 1 } = {},
) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "bundle-budgets-"));
	context.after(() => fs.rmSync(root, { recursive: true, force: true }));
	const analyze = path.join(root, ".next", "diagnostics", "analyze");
	fs.mkdirSync(path.join(analyze, "data"), { recursive: true });
	fs.writeFileSync(
		path.join(root, "bundle-budgets.json"),
		JSON.stringify(budgets),
	);
	fs.writeFileSync(
		path.join(analyze, "data", "route-summaries.json"),
		JSON.stringify([
			{ route: "/", client: { size: routeBytes, compressed_size: 400 } },
		]),
	);
	const graph = [
		{
			type: "meta",
			schema_version: 1,
			route_count: routeCount,
			selected_routes: routeCount,
		},
		{ type: "route", route: "/" },
		{
			type: "part",
			filename: "[client-fs]/chunk.js",
			source_path: "[project]/node_modules/next/dist/client/index.js",
			size: nextBytes,
		},
		{
			type: "part",
			filename: "[server-fs]/chunk.js",
			source_path: "[project]/node_modules/pg/lib/index.js",
			size: 99_999,
		},
	];
	fs.writeFileSync(
		path.join(analyze, "bundle-graph.jsonl"),
		graph.map((record) => JSON.stringify(record)).join("\n"),
	);
	return root;
}

function check(cwd: string) {
	return spawnSync(process.execPath, [script], {
		cwd,
		encoding: "utf8",
		env: { ...process.env, GITHUB_STEP_SUMMARY: "" },
	});
}

test("routes and browser packages within budget pass and are reported", (context) => {
	const result = check(project(context));
	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stdout, /\| \/ \| 900 \/ 1000 \| 400 \/ 500 \| pass \|/);
	assert.match(result.stdout, /\| next \| 700 \/ 800 \| pass \|/);
	assert.doesNotMatch(result.stdout, /\bpg\b/);
});

test("a route over its client budget fails", (context) => {
	const result = check(project(context, { routeBytes: 1001 }));
	assert.equal(result.status, 1);
	assert.match(result.stderr, /route \/ exceeds its client budget/);
});

test("a browser package over its budget fails", (context) => {
	const result = check(project(context, { nextBytes: 801 }));
	assert.equal(result.status, 1);
	assert.match(result.stderr, /package next exceeds its browser budget/);
});

test("a filtered analyzer export is rejected instead of passing", (context) => {
	const result = check(project(context, { routeCount: 2 }));
	assert.equal(result.status, 1);
	assert.match(result.stderr, /complete, unfiltered analyzer export/);
});
