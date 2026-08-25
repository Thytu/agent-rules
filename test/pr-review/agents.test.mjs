import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { loadAgents, OWNER_BUDGET } from "../../tooling/pr-review/agents.mjs";

const OWNERS = [
	"authorization-persistence",
	"boundaries",
	"comments",
	"contract-evolution",
	"dependency-integrity",
	"efficiency",
	"lifecycle-capacity",
	"testing",
];

function repository(t) {
	const root = mkdtempSync(join(tmpdir(), "agent-rules-agents-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	mkdirSync(join(root, "docs", "rules"), { recursive: true });
	for (const owner of OWNERS)
		writeFileSync(join(root, "docs", "rules", `${owner}.md`), `# ${owner}\n`);
	return root;
}

const expected = OWNERS.map((id) => ({ id, doc: `docs/rules/${id}.md` }));

test("discovers the exact sorted eight-owner catalog", (t) => {
	const root = repository(t);
	assert.equal(OWNER_BUDGET, 8);
	assert.deepEqual(loadAgents(root), expected);
});

test("runtime markers do not create profile reviewers", (t) => {
	const root = repository(t);
	writeFileSync(join(root, "Cargo.toml"), "[workspace]\n");
	writeFileSync(join(root, "package.json"), "{}\n");
	writeFileSync(join(root, "tsconfig.json"), "{}\n");
	assert.deepEqual(loadAgents(root), expected);
});

test("a missing owner fails the declared review budget", (t) => {
	const root = repository(t);
	rmSync(join(root, "docs", "rules", "testing.md"));
	assert.throws(() => loadAgents(root), /count 7.*budget 8/);
});

test("a ninth owner cannot silently add a review wave", (t) => {
	const root = repository(t);
	writeFileSync(join(root, "docs", "rules", "rogue.md"), "# Rogue\n");
	assert.throws(() => loadAgents(root), /count 9.*budget 8/);
});
