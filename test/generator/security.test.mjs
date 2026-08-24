import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function authorize(t, paths, env) {
	const dir = mkdtempSync(join(tmpdir(), "agent-rules-auth-"));
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	const changed = join(dir, "changed");
	writeFileSync(
		changed,
		Buffer.from(paths.map((path) => `${path}\0`).join("")),
	);
	return spawnSync(
		"bash",
		["template/core/files/scripts/authorize-changes.sh", "--source", changed],
		{
			cwd: root,
			encoding: "utf8",
			env: {
				...process.env,
				HEAD_REPO: "org/repo",
				BASE_REPO: "org/repo",
				ACTOR: "contributor",
				HEAD_REF: "feature/change",
				INTEGRATION_OWNER: "owner",
				...env,
			},
		},
	);
}

test("only the exact integration owner may change policy", (t) => {
	const owner = authorize(t, [".github/workflows/ci.yml"], {
		ACTOR: "owner",
		HEAD_REF: "integration/policy",
	});
	assert.equal(owner.status, 0);
	const spoof = authorize(t, [".github/workflows/ci.yml"], {
		ACTOR: "contributor",
		HEAD_REF: "integration/policy",
	});
	assert.notEqual(spoof.status, 0);
	assert.match(spoof.stderr, /unauthorized integration-owned source path/);
});

test("Dependabot is limited to manifest and lock changes", (t) => {
	const allowed = authorize(t, ["package.json", "pnpm-lock.yaml"], {
		ACTOR: "dependabot[bot]",
		HEAD_REF: "dependabot/npm/update",
	});
	assert.equal(allowed.status, 0);
	const policy = authorize(t, ["package.json", ".github/workflows/ci.yml"], {
		ACTOR: "dependabot[bot]",
		HEAD_REF: "dependabot/npm/update",
	});
	assert.notEqual(policy.status, 0);
});

test("ordinary product paths do not require integration ownership", (t) => {
	assert.equal(authorize(t, ["app/feature.ts"], {}).status, 0);
});

test("append-only guard permits ordinary commits and rejects amend", () => {
	const script = "template/core/files/scripts/guard-append-only.sh";
	assert.equal(
		spawnSync("bash", [script, "amend", "message", ""], { cwd: root }).status,
		0,
	);
	assert.notEqual(
		spawnSync("bash", [script, "amend", "commit", "HEAD"], { cwd: root })
			.status,
		0,
	);
});

test("trusted workflows isolate guard, quality, and AI review", () => {
	const guard = readFileSync(
		join(root, ".github", "workflows", "guard.yml"),
		"utf8",
	);
	const emittedGuard = readFileSync(
		join(
			root,
			"template",
			"core",
			"files",
			".github",
			"workflows",
			"guard.yml",
		),
		"utf8",
	);
	const quality = readFileSync(
		join(root, ".github", "workflows", "ci.yml"),
		"utf8",
	);
	const review = readFileSync(
		join(root, ".github", "workflows", "ai-review.yml"),
		"utf8",
	);
	for (const workflow of [guard, emittedGuard]) {
		assert.match(workflow, /pull_request_target:/);
		assert.match(workflow, /git merge-base "\$BASE_SHA" "\$HEAD_SHA"/);
		assert.match(workflow, /git diff --name-only -z --no-renames/);
		assert.doesNotMatch(workflow, /run: (?:node|bash) .*HEAD_SHA/);
	}
	assert.match(quality, /\n\s{2}pull_request:\n/);
	assert.doesNotMatch(quality, /secrets\./);
	assert.match(review, /pull_request_target:/);
	for (const workflow of [quality, review]) {
		assert.ok(
			workflow.indexOf("pnpm/action-setup@") <
				workflow.indexOf("actions/setup-node@"),
			"pnpm must exist before setup-node resolves its cache",
		);
	}
	assert.match(
		review,
		/ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/,
	);
	assert.match(
		review,
		/refs\/pull\/\$\{PR_NUMBER\}\/head:refs\/remotes\/pull\/head/,
	);
	assert.match(
		review,
		/test "\$\(git rev-parse refs\/remotes\/pull\/head\)" = "\$HEAD_SHA"/,
	);
});

test("merge-base diff excludes base-only changes and expands renames", (t) => {
	const repo = mkdtempSync(join(tmpdir(), "agent-rules-diff-"));
	t.after(() => rmSync(repo, { recursive: true, force: true }));
	const git = (...args) =>
		execFileSync(
			"git",
			[
				"-c",
				"user.name=Guard Test",
				"-c",
				"user.email=guard@example.com",
				"-C",
				repo,
				...args,
			],
			{ encoding: "utf8" },
		).trim();
	git("init", "-b", "main");
	writeFileSync(join(repo, "old.txt"), "old\n");
	git("add", ".");
	git("commit", "-qm", "initial");
	git("checkout", "-qb", "feature");
	git("mv", "old.txt", "new.txt");
	git("commit", "-qm", "rename");
	const head = git("rev-parse", "HEAD");
	git("checkout", "-q", "main");
	writeFileSync(join(repo, "main-only.txt"), "main\n");
	git("add", ".");
	git("commit", "-qm", "main advance");
	const base = git("rev-parse", "HEAD");
	const mergeBase = git("merge-base", base, head);
	const changed = git(
		"diff",
		"--name-only",
		"--no-renames",
		mergeBase,
		head,
	).split("\n");
	assert.deepEqual(changed, ["new.txt", "old.txt"]);
	assert.ok(!changed.includes("main-only.txt"));
});
