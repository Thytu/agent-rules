import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("pull request templates require visual behavior summaries", () => {
	const templates = [
		readFileSync(join(root, ".github", "PULL_REQUEST_TEMPLATE.md"), "utf8"),
		readFileSync(
			join(
				root,
				"template",
				"core",
				"files",
				".github",
				"PULL_REQUEST_TEMPLATE.md",
			),
			"utf8",
		),
	];
	for (const template of templates) {
		assert.match(template, /> \*\*Outcome:\*\*/);
		assert.match(template, /\| Surface or contract \| Before \| After \|/);
		assert.match(template, /\| Procedure \| Evidence \|/);
		assert.match(template, /\| Risk \| Bound \|/);
		assert.match(template, /^---$/m);
		assert.match(template, /never file paths/);
	}
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

test("pre-commit stays fast while pre-push runs the full gate", () => {
	const sourceCommit = readFileSync(
		join(root, ".githooks", "pre-commit"),
		"utf8",
	);
	const sourcePush = readFileSync(join(root, ".githooks", "pre-push"), "utf8");
	const generatedHooks = join(root, "template", "core", "files", ".githooks");
	const generatedCommit = readFileSync(
		join(generatedHooks, "pre-commit"),
		"utf8",
	);
	const generatedPush = readFileSync(join(generatedHooks, "pre-push"), "utf8");

	assert.match(sourceCommit, /verify\.sh" --source/);
	assert.match(sourceCommit, /pnpm format:check/);
	assert.match(sourceCommit, /pnpm lint/);
	assert.doesNotMatch(sourceCommit, /pnpm verify/);
	assert.match(generatedCommit, /verify\.sh" --structure-only/);
	assert.match(sourcePush, /pnpm verify/);
	assert.match(generatedPush, /verify\.sh"$/m);
});

test("workflow triggers use least privilege", () => {
	const policy = readFileSync(
		join(root, ".github", "workflows", "pull-request.yml"),
		"utf8",
	);
	const emittedPolicy = readFileSync(
		join(
			root,
			"template",
			"core",
			"files",
			".github",
			"workflows",
			"pull-request.yml",
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
	for (const workflow of [policy, emittedPolicy]) {
		assert.match(workflow, /\n\s{2}pull_request:\n/);
		assert.match(workflow, /github\.event\.pull_request\.base\.ref/);
		assert.doesNotMatch(
			workflow,
			/pull_request_target:|actions\/checkout|secrets\.|INTEGRATION_OWNER|authorize-changes/,
		);
	}
	assert.match(quality, /\n\s{2}pull_request:\n/);
	assert.doesNotMatch(quality, /secrets\./);
	assert.match(review, /pull_request_target:/);
	assert.match(review, /secrets\.OPENAI_API_KEY/);
	assert.doesNotMatch(review, /DEEPSEEK_API_KEY/);
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
