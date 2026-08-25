import assert from "node:assert/strict";
import { test } from "node:test";

import { loadAgents } from "../../tooling/pr-review/agents.mjs";
import { verifyBlindCorpus } from "../../tooling/pr-review/blind-integrity.mjs";
import { cases as dev } from "../../tooling/pr-review/cases.mjs";
import { cases as blind } from "../../tooling/pr-review/cases.blind.mjs";
import { cases as holdout } from "../../tooling/pr-review/cases.holdout.mjs";
import { parseDiff } from "../../tooling/pr-review/inline.mjs";
import { createFixtureRepository } from "../../tooling/pr-review/fixture-repository.mjs";

const owners = loadAgents().map((agent) => agent.id);

test("blind corpus matches its frozen digest", async () => {
	assert.match(await verifyBlindCorpus(), /^[0-9a-f]{64}$/);
});

test("fixture ids are unique across evaluation corpora", () => {
	const ids = [...dev, ...holdout, ...blind].map((fixture) => fixture.id);
	assert.equal(new Set(ids).size, ids.length);
});

for (const [name, cases] of [
	["development", dev],
	["holdout", holdout],
	["blind", blind],
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
			assert.match(repository.baseSha, /^[0-9a-f]{40}$/);
			assert.match(repository.headSha, /^[0-9a-f]{40}$/);
			assert.equal(repository.baseSha.includes(fixture.id), false);
			assert.equal(repository.headSha.includes(fixture.id), false);
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
	"lifecycle-detached-task": ["boundaries", "lifecycle-capacity"],
	"mixed-bs-and-shortcut": [
		"authorization-persistence",
		"comments",
		"contract-evolution",
	],
	"hp-shortcut-return-free": ["comments", "contract-evolution"],
	"hp-shortcut-default-on-catch": [
		"authorization-persistence",
		"boundaries",
		"lifecycle-capacity",
	],
	"hp-shortcut-fixme-nplusone": [
		"comments",
		"contract-evolution",
		"efficiency",
	],
	"hp-shortcut-empty-list-catch": [
		"authorization-persistence",
		"boundaries",
		"lifecycle-capacity",
	],
	"hp-legacy-renamed-column": ["boundaries", "contract-evolution"],
	"blind-contract-parallel-v2": ["boundaries", "contract-evolution"],
	"blind-efficiency-config-parse-in-loop": ["boundaries", "efficiency"],
	"blind-lifecycle-detached-provider-job": ["boundaries", "lifecycle-capacity"],
};

test("overlapping violations carry every applicable owner label", () => {
	const byId = new Map(
		[...dev, ...holdout, ...blind].map((fixture) => [fixture.id, fixture]),
	);
	for (const [id, expected] of Object.entries(exhaustiveLabels))
		assert.deepEqual(
			[...byId.get(id).violations].sort(),
			[...expected].sort(),
			id,
		);
});

const realSubjects = {
	"real-root-fonts": {
		anchor:
			"// Fonts are self-hosted (open-source product — no CDN); @font-face lives in",
		lines: 2,
	},
	"real-icon-set": {
		anchor:
			"// One icon set, one stroke weight (1.7, round caps) — mixed icon libraries",
		lines: 2,
	},
	"real-tabs-weight": {
		anchor:
			"// Active state changes color and underline, never weight — a weight change",
		lines: 2,
	},
	"real-textlink-petrol": {
		anchor:
			"// The only place petrol touches prose. Table titles and data stay ink —",
		lines: 2,
	},
	"real-chip-sanctioned-style": {
		anchor:
			"// User-picked colors (e.g. a track's configured color) render as a DOT next",
		lines: 4,
	},
	"real-table-shadow": {
		anchor:
			"// Selection = wash + ONE 2px petrol rule on the leading edge only",
		lines: 2,
	},
	"real-status-badge-dark": {
		anchor:
			"// Status hues carry fixed semantic meaning across skins and themes, so they",
		lines: 2,
	},
	"real-avatar-identity": {
		anchor:
			"// Deterministic identity colors: same name, same hue, both themes readable.",
		lines: 3,
	},
	"real-button-primitive": {
		anchor:
			"// Primitives never accept className/style: every visual decision stays in",
		lines: 2,
	},
	"real-track-clock": {
		anchor:
			"// Per-request phase timings, surfaced once as a Server-Timing header.",
		lines: 3,
	},
	"real-auth-pbkdf2": {
		anchor:
			"// The Workers runtime hard-caps PBKDF2 deriveBits at 100k iterations in",
		lines: 3,
	},
	"real-auth-writeamp": {
		anchor:
			"// Unknown id (e.g. a garbage/forged cookie) → no DB write, so random cookies",
		lines: 2,
	},
	"real-worker-env": {
		anchor:
			"// Runtime SECRETS (added via wrangler secret put, not wrangler.json bindings,",
		lines: 3,
	},
	"real-email-throw": { anchor: "if (!from) {", lines: 5 },
	"real-resend-test": {
		anchor: 'it("throws on a non-2xx provider response',
		lines: 18,
	},
	"real-inject-header": {
		anchor:
			"// Inject deployer-specific values into a wrangler config from the environment,",
		lines: 3,
	},
	"real-bs-capabilities": {
		anchor:
			"// The nine capabilities the product actually ships (SCOPE's six firm",
		lines: 3,
	},
	"real-track-header": {
		anchor:
			"// Structured runtime events — the queryable record of what the app did",
		lines: 3,
	},
	"real-skeleton": {
		anchor:
			"// Loading holds the page's shape — skeletons, never spinners, for lists.",
		lines: 1,
	},
	"real-empty-state": {
		anchor:
			"// Explain why the view is empty and include a next action when recovery is",
		lines: 2,
	},
	"real-entry-bots": {
		anchor:
			"// Bots and SPA-mode renders must wait for all content before responding, so",
		lines: 2,
	},
};

test("real holdout changes preserve full source and narrow diffs", () => {
	const realFixtures = holdout.filter((entry) => entry.source === "real");
	assert.deepEqual(
		realFixtures.map((fixture) => fixture.id).sort(),
		Object.keys(realSubjects).sort(),
	);
	for (const fixture of realFixtures) {
		const subject = realSubjects[fixture.id];
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
		const added = parseDiff(repository.getRawDiff(path)).newLines.filter(
			(line) => line.added,
		);
		assert.equal(
			added.length,
			subject.lines,
			`${fixture.id} adds lines outside its reviewed subject`,
		);
		assert.ok(
			added[0].text.trim().startsWith(subject.anchor),
			`${fixture.id} diff does not start with its reviewed subject`,
		);
		for (let index = 1; index < added.length; index++)
			assert.equal(
				added[index].line,
				added[0].line + index,
				`${fixture.id} has a second added hunk outside its reviewed subject`,
			);
		assert.equal(
			change.deletions,
			0,
			`${fixture.id} deletes lines outside its reviewed subject`,
		);
		assert.ok(
			change.additions < fixture.repository.head[path].split("\n").length,
			`${fixture.id} exposes its whole source file as added code`,
		);
	}
});
