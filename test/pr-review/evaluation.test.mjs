import assert from "node:assert/strict";
import { test } from "node:test";

import { loadAgents } from "../../tooling/pr-review/agents.mjs";
import { cases as dev } from "../../tooling/pr-review/cases.mjs";
import { cases as holdout } from "../../tooling/pr-review/cases.holdout.mjs";
import { createFixtureRepository } from "../../tooling/pr-review/fixture-repository.mjs";

const owners = loadAgents().map((agent) => agent.id);

for (const [name, cases] of [
	["development", dev],
	["holdout", holdout],
]) {
	test(`${name} evaluation covers every owner`, () => {
		const known = new Set(owners);
		for (const fixture of cases) {
			for (const owner of fixture.violations ?? [])
				assert.ok(
					known.has(owner),
					`${fixture.id} names unknown owner ${owner}`,
				);
		}
		assert.ok(
			cases.some((fixture) => fixture.violations?.length === 0),
			`${name} has no clean fixture`,
		);
		for (const owner of owners)
			assert.ok(
				cases.some((fixture) => fixture.violations?.includes(owner)),
				`${name} has no positive for ${owner}`,
			);
	});

	test(`${name} evaluation uses complete repository snapshots`, async () => {
		for (const fixture of cases) {
			assert.equal(
				"file" in fixture,
				false,
				`${fixture.id} exposes a lone file`,
			);
			assert.equal("code" in fixture, false, `${fixture.id} exposes a snippet`);
			assert.ok(fixture.repository, `${fixture.id} has no repository`);
			assert.ok(
				Object.keys(fixture.repository.head).length >= 6,
				`${fixture.id} lacks explorable repository context`,
			);
			assert.ok(
				Object.keys(fixture.repository.base).length >= 5,
				`${fixture.id} lacks base-revision context`,
			);
			assert.ok(
				fixture.repository.changed.every(
					(path) =>
						path in fixture.repository.head || path in fixture.repository.base,
				),
				`${fixture.id} names a missing changed path`,
			);
			assert.equal(
				new Set(fixture.violations).size,
				fixture.violations.length,
				`${fixture.id} repeats an owner label`,
			);

			const repository = createFixtureRepository(fixture);
			const listed = await repository.executeTool("list_repository");
			assert.equal(listed.ok, true);
			assert.ok(listed.paths.length >= 6);
			const unchanged = listed.paths.find(
				(path) => !fixture.repository.changed.includes(path),
			);
			const read = await repository.executeTool("read_file", {
				path: unchanged,
				revision: "base",
			});
			assert.equal(read.ok, true, `${fixture.id} cannot read base context`);
		}
	});
}

const exhaustiveLabels = {
	"bs-tier-citation": ["authorization-persistence", "comments"],
	"shortcut-todo-unbounded": [
		"authorization-persistence",
		"comments",
		"contract-evolution",
	],
	"shortcut-hardcoded-id": [
		"authorization-persistence",
		"comments",
		"contract-evolution",
	],
	"shortcut-swallowed-error": ["boundaries", "comments", "lifecycle-capacity"],
	"shortcut-noop-validation": ["boundaries", "comments", "contract-evolution"],
	"legacy-dual-format-reader": ["boundaries", "contract-evolution"],
	"legacy-parallel-v2": ["boundaries", "contract-evolution"],
	"cost-reparse-in-loop": ["boundaries", "efficiency"],
	"mixed-bs-and-shortcut": [
		"authorization-persistence",
		"comments",
		"contract-evolution",
	],
	"hp-shortcut-return-free": ["comments", "contract-evolution"],
	"hp-shortcut-default-on-catch": ["boundaries", "lifecycle-capacity"],
	"hp-shortcut-fixme-nplusone": [
		"comments",
		"contract-evolution",
		"efficiency",
	],
	"hp-shortcut-empty-list-catch": ["boundaries", "lifecycle-capacity"],
	"hp-legacy-renamed-column": ["boundaries", "contract-evolution"],
};

test("overlapping violations carry every applicable owner label", () => {
	const byId = new Map(
		[...dev, ...holdout].map((fixture) => [fixture.id, fixture]),
	);
	for (const [id, expected] of Object.entries(exhaustiveLabels))
		assert.deepEqual(
			[...byId.get(id).violations].sort(),
			[...expected].sort(),
			id,
		);
});

test("real holdout changes preserve full source and narrow diffs", () => {
	for (const fixture of holdout.filter((entry) => entry.source === "real")) {
		const path = fixture.repository.changed[0];
		assert.ok(
			path in fixture.repository.base,
			`${fixture.id} has no real base file`,
		);
		assert.ok(
			Object.keys(fixture.repository.head).length >= 700,
			`${fixture.id} lacks its complete real repository context`,
		);
		const repository = createFixtureRepository(fixture);
		const change = repository.changes[0];
		assert.equal(
			change.status,
			"M",
			`${fixture.id} is not a modified real file`,
		);
		assert.ok(change.additions > 0, `${fixture.id} has no changed subject`);
		assert.ok(
			change.additions < fixture.repository.head[path].split("\n").length,
			`${fixture.id} exposes its whole source file as added code`,
		);
	}
});
