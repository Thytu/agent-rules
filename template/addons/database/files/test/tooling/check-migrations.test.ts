import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { type TestContext, test } from "node:test";

const script = path.resolve("tooling/check-migrations.mjs");
const journal = (tags: string[]) =>
	`${JSON.stringify({
		version: "7",
		dialect: "postgresql",
		entries: tags.map((tag, idx) => ({
			idx,
			version: "7",
			when: idx,
			tag,
			breakpoints: true,
		})),
	})}\n`;

// A repository with one committed migration, and a drizzle-kit stub whose exit
// status the test controls.
function repository(context: TestContext) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-migrations-"));
	context.after(() => fs.rmSync(root, { recursive: true, force: true }));
	const bin = path.join(root, ".bin");
	fs.mkdirSync(bin);
	fs.writeFileSync(
		path.join(bin, "drizzle-kit"),
		'#!/bin/sh\nexit "${DRIZZLE_STATUS:-0}"\n',
	);
	fs.chmodSync(path.join(bin, "drizzle-kit"), 0o755);
	const env = {
		...process.env,
		PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}`,
		GIT_CONFIG_GLOBAL: path.join(root, ".gitconfig"),
		GIT_CONFIG_NOSYSTEM: "1",
	};
	const git = (...args: string[]) =>
		execFileSync(
			"git",
			["-c", "user.name=Test", "-c", "user.email=test@example.com", ...args],
			{
				cwd: root,
				env,
				encoding: "utf8",
			},
		);
	const write = (file: string, content: string) => {
		fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
		fs.writeFileSync(path.join(root, file), content);
	};
	git("init", "--quiet");
	write(".gitignore", ".bin/\n.gitconfig\n");
	write(
		"db/migrations/20260101000000_init.sql",
		"CREATE TABLE accounts (id uuid);\n",
	);
	write("db/migrations/meta/_journal.json", journal(["20260101000000_init"]));
	git("add", ".");
	git("commit", "--quiet", "-m", "init");
	const check = (extra: Record<string, string> = {}) =>
		spawnSync(process.execPath, [script], {
			cwd: root,
			env: { ...env, ...extra },
			encoding: "utf8",
		});
	return { git, write, check, root };
}

test("a repository without migrations passes", (context) => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-migrations-"));
	context.after(() => fs.rmSync(root, { recursive: true, force: true }));
	const result = spawnSync(process.execPath, [script], {
		cwd: root,
		encoding: "utf8",
	});
	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stdout, /no migrations yet/);
});

test("a new migration with an appended journal entry passes", (context) => {
	const repo = repository(context);
	repo.write(
		"db/migrations/20260102000000_notes.sql",
		"CREATE TABLE notes (id uuid);\n",
	);
	repo.write(
		"db/migrations/meta/_journal.json",
		journal(["20260101000000_init", "20260102000000_notes"]),
	);
	repo.git("add", ".");
	const result = repo.check();
	assert.equal(result.status, 0, result.stderr);
});

test("editing or deleting a committed migration fails", (context) => {
	const repo = repository(context);
	repo.write(
		"db/migrations/20260101000000_init.sql",
		"CREATE TABLE accounts (id text);\n",
	);
	repo.git("add", ".");
	const edited = repo.check();
	assert.equal(edited.status, 1);
	assert.match(
		edited.stderr,
		/20260101000000_init\.sql: an applied migration was modified/,
	);
	repo.git("rm", "--quiet", "-f", "db/migrations/20260101000000_init.sql");
	const deleted = repo.check();
	assert.equal(deleted.status, 1);
	assert.match(deleted.stderr, /an applied migration was deleted/);
});

test("rewriting existing journal entries fails", (context) => {
	const repo = repository(context);
	repo.write(
		"db/migrations/meta/_journal.json",
		journal(["20260101000000_renamed"]),
	);
	repo.git("add", ".");
	const result = repo.check();
	assert.equal(result.status, 1);
	assert.match(
		result.stderr,
		/existing journal entries were changed or removed/,
	);
});

test("a drizzle-kit check failure fails the migration check", (context) => {
	const repo = repository(context);
	const result = repo.check({ DRIZZLE_STATUS: "1" });
	assert.notEqual(result.status, 0);
});
