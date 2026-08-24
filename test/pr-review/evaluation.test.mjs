import assert from "node:assert/strict";
import { test } from "node:test";

import { loadAgents } from "../../tooling/pr-review/agents.mjs";
import { cases as dev } from "../../tooling/pr-review/cases.mjs";
import { cases as holdout } from "../../tooling/pr-review/cases.holdout.mjs";

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
			for (const owner of fixture.cleanFor ?? [])
				assert.ok(
					known.has(owner),
					`${fixture.id} names unknown clean owner ${owner}`,
				);
		}
		for (const owner of owners) {
			assert.ok(
				cases.some((fixture) => fixture.violations?.includes(owner)),
				`${name} has no positive for ${owner}`,
			);
			assert.ok(
				cases.some(
					(fixture) =>
						fixture.violations?.length === 0 &&
						fixture.cleanFor?.includes(owner),
				),
				`${name} has no clean trap for ${owner}`,
			);
		}
	});
}
