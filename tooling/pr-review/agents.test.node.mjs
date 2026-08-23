import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { loadAgents } from "./agents.mjs";

function repository(t) {
	const root = mkdtempSync(join(tmpdir(), "agent-rules-agents-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	mkdirSync(join(root, "docs", "rules"), { recursive: true });
	mkdirSync(join(root, "docs", "profiles"), { recursive: true });
	writeFileSync(join(root, "docs", "rules", "zeta.md"), "# Zeta\n");
	writeFileSync(join(root, "docs", "rules", "alpha.md"), "# Alpha\n");
	writeFileSync(join(root, "docs", "profiles", "rust.md"), "# Rust\n");
	return root;
}

test("Rust review is absent without a Cargo workspace", (t) => {
	const root = repository(t);
	assert.deepEqual(loadAgents(root), [
		{ id: "alpha", doc: "docs/rules/alpha.md" },
		{ id: "zeta", doc: "docs/rules/zeta.md" },
	]);
});

test("Cargo.toml activates the Rust rule owner", (t) => {
	const root = repository(t);
	writeFileSync(join(root, "Cargo.toml"), "[workspace]\n");
	assert.deepEqual(loadAgents(root), [
		{ id: "alpha", doc: "docs/rules/alpha.md" },
		{ id: "rust", doc: "docs/profiles/rust.md" },
		{ id: "zeta", doc: "docs/rules/zeta.md" },
	]);
});
