import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	chmodSync,
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

// The commit gate (scripts/verify-commit.sh, run by the pre-commit and
// pre-merge-commit hooks) must verify exactly the tree Git commits.
const generated = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../template/core/files",
);

function repository(t) {
	const root = mkdtempSync(join(tmpdir(), "commit-gate-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const env = {
		...process.env,
		GIT_CONFIG_NOSYSTEM: "1",
		GIT_CONFIG_GLOBAL: join(root, ".git", "empty-config"),
	};
	for (const key of Object.keys(env))
		if (/^GIT_(DIR|WORK_TREE|INDEX_FILE)$/.test(key)) delete env[key];
	const git = (...args) =>
		spawnSync("git", args, {
			cwd: root,
			env,
			encoding: "utf8",
			timeout: 20_000,
		});
	assert.equal(git("init", "--quiet", "-b", "main").status, 0);
	for (const [key, value] of [
		["user.name", "Gate test"],
		["user.email", "gate@example.test"],
		["commit.gpgsign", "false"],
		["core.hooksPath", ".githooks"],
	])
		assert.equal(git("config", key, value).status, 0);
	for (const file of [
		".githooks/pre-commit",
		".githooks/pre-merge-commit",
		"scripts/verify-commit.sh",
	]) {
		mkdirSync(dirname(join(root, file)), { recursive: true });
		copyFileSync(join(generated, file), join(root, file));
		chmodSync(join(root, file), 0o755);
	}
	const write = (file, content) => writeFileSync(join(root, file), content);
	// A stand-in for scripts/verify.sh that records the tree it verified.
	const verify = (body) =>
		write(
			"scripts/verify.sh",
			`#!/usr/bin/env bash\nset -euo pipefail\n[ "$*" = --commit ] || exit 9\n${body}\n`,
		);
	verify(
		'if [ -f .git/reject-gate ]; then echo "full verification failed" >&2; exit 37; fi\ngit write-tree > .git/verified-tree',
	);
	write("source.ts", "export const value = 1;\n");
	assert.equal(git("add", ".").status, 0);
	const initial = git("commit", "--quiet", "-m", "initial");
	assert.equal(initial.status, 0, initial.stderr);
	const head = git("rev-parse", "HEAD").stdout;
	unlinkSync(join(root, ".git", "verified-tree"));
	return { root, git, write, verify, head };
}

test("a failing gate prevents Git from creating the commit", (t) => {
	const repo = repository(t);
	repo.verify('echo "full verification failed" >&2; exit 37');
	assert.equal(repo.git("add", ".").status, 0);
	const result = repo.git("commit", "-m", "failing gate");
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /full verification failed/);
	assert.equal(repo.git("rev-parse", "HEAD").stdout, repo.head);
});

test("a failing gate prevents an automatic merge commit", (t) => {
	const repo = repository(t);
	assert.equal(repo.git("checkout", "-q", "-b", "incoming").status, 0);
	repo.write("incoming.ts", "export const incoming = true;\n");
	assert.equal(repo.git("add", ".").status, 0);
	assert.equal(repo.git("commit", "-qm", "incoming").status, 0);
	assert.equal(repo.git("checkout", "-q", "main").status, 0);
	repo.write("base.ts", "export const base = true;\n");
	assert.equal(repo.git("add", ".").status, 0);
	assert.equal(repo.git("commit", "-qm", "base").status, 0);
	const head = repo.git("rev-parse", "HEAD").stdout;
	repo.write(".git/reject-gate", "reject");
	const result = repo.git("merge", "--no-ff", "--no-edit", "incoming");
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /full verification failed/);
	assert.equal(repo.git("rev-parse", "HEAD").stdout, head);
});

test("a passing gate verified exactly the tree Git committed", (t) => {
	const repo = repository(t);
	repo.write("source.ts", "export const value = 2;\n");
	assert.equal(repo.git("add", ".").status, 0);
	const result = repo.git("commit", "-m", "passing gate");
	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stderr, /commit gate: passed in \d+s/);
	assert.equal(
		readFileSync(join(repo.root, ".git", "verified-tree"), "utf8"),
		repo.git("rev-parse", "HEAD^{tree}").stdout,
	);
});

test("an unstaged correction cannot hide broken staged code", (t) => {
	const repo = repository(t);
	repo.write("source.ts", "broken staged code\n");
	assert.equal(repo.git("add", "source.ts").status, 0);
	repo.write("source.ts", "export const value = 2;\n");
	const result = repo.git("commit", "-m", "partially staged");
	assert.notEqual(result.status, 0);
	assert.match(
		result.stderr,
		/these tracked files have unstaged changes:\n {2}source\.ts/,
	);
	assert.match(
		result.stderr,
		/git stash push --keep-index --include-untracked/,
	);
	assert.equal(repo.git("rev-parse", "HEAD").stdout, repo.head);
	assert.equal(existsSync(join(repo.root, ".git", "verified-tree")), false);
});

test("an untracked file cannot influence the verified commit", (t) => {
	const repo = repository(t);
	repo.write("helper.ts", "export const value = 2;\n");
	const result = repo.git("commit", "--allow-empty", "-m", "untracked helper");
	assert.notEqual(result.status, 0);
	assert.match(
		result.stderr,
		/these files are untracked and not ignored:\n {2}helper\.ts/,
	);
	assert.equal(repo.git("rev-parse", "HEAD").stdout, repo.head);
});

for (const stage of [false, true]) {
	test(`a check that rewrites files rejects the commit (staged: ${stage})`, (t) => {
		const repo = repository(t);
		repo.verify(
			`printf 'export const value = 3;\\n' > source.ts\n${stage ? "git add source.ts" : ""}`,
		);
		assert.equal(repo.git("add", ".").status, 0);
		const result = repo.git("commit", "-m", "changed during verification");
		assert.notEqual(result.status, 0);
		assert.match(
			result.stderr,
			/the verified tree no longer matches the commit/,
		);
		assert.equal(repo.git("rev-parse", "HEAD").stdout, repo.head);
	});
}
