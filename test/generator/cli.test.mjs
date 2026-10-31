import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	cpSync,
	lstatSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	readlinkSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

// The command-line contract of init.sh: every request that cannot proceed says
// why and how to fix it, and only a confirmed, valid request changes anything.
const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
// Hooks export GIT_DIR; inherited, it would point Git at this checkout.
const env = Object.fromEntries(
	Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")),
);

function git(root, ...args) {
	return execFileSync(
		"git",
		[
			"-c",
			"user.name=CLI Test",
			"-c",
			"user.email=cli@example.com",
			"-C",
			root,
			...args,
		],
		{ encoding: "utf8", env },
	).trim();
}

function repository(t) {
	const temp = mkdtempSync(join(tmpdir(), "agent-rules-cli-"));
	t.after(() => rmSync(temp, { recursive: true, force: true }));
	const root = join(temp, "repo");
	cpSync(sourceRoot, root, {
		recursive: true,
		verbatimSymlinks: true,
		filter: (path) => {
			const rel = relative(sourceRoot, path);
			return ![".git", "node_modules", ".agent-rules"].some(
				(entry) => rel === entry || rel.startsWith(`${entry}/`),
			);
		},
	});
	git(root, "init", "-q", "-b", "main");
	git(root, "add", ".");
	git(root, "commit", "-qm", "chore: template");
	git(
		root,
		"remote",
		"add",
		"origin",
		"https://github.com/example/product.git",
	);
	return root;
}

function snapshot(root) {
	const hash = createHash("sha256");
	const walk = (dir) => {
		for (const name of readdirSync(dir).sort()) {
			if (dir === root && name === ".git") continue;
			const path = join(dir, name);
			const stat = lstatSync(path);
			hash.update(`${relative(root, path)}\0${stat.mode}\0`);
			if (stat.isSymbolicLink()) hash.update(readlinkSync(path));
			else if (stat.isFile()) hash.update(readFileSync(path));
			else if (stat.isDirectory()) walk(path);
		}
	};
	walk(root);
	return hash.digest("hex");
}

function init(root, args, input) {
	const result = spawnSync(join(root, "init.sh"), args, {
		cwd: root,
		encoding: "utf8",
		input,
		env: { ...env, NO_COLOR: "1" },
	});
	return { ...result, output: `${result.stdout}${result.stderr}` };
}

const refusals = [
	{
		args: ["ts"],
		message: /'ts' is not a language\. Did you mean 'typescript'\?/,
	},
	{
		args: ["typescript", "--with", "next"],
		message: /unknown add-on 'next'\. Did you mean 'nextjs'\?/,
	},
	{
		args: ["python", "--with", "react"],
		message:
			/the react add-on needs typescript\n {2}Try: \.\/init\.sh python,typescript --with react/,
	},
	{
		args: ["typescript", "--with", "database"],
		message:
			/choose a dialect for the database add-on: database=postgresql or database=sqlite/,
	},
	{
		args: ["typescript", "--with", "database=mysql"],
		message:
			/unknown dialect 'mysql' for database; choose postgresql or sqlite/,
	},
	{
		args: ["typescript", "--with", "database=sqlite,database=postgresql"],
		message: /choose one dialect for database, not both sqlite and postgresql/,
	},
	{
		args: ["typescript", "--wiht", "react"],
		message: /unknown option --wiht\. Did you mean --with\?/,
	},
	{
		args: ["--with", "react"],
		message:
			/name the languages too, for example: \.\/init\.sh typescript --with react/,
	},
	{
		args: ["typescript", "--with", "react=yes"],
		message: /the react add-on takes no value/,
	},
];

test("invalid requests exit 2 with the fix and change nothing", (t) => {
	const root = repository(t);
	const before = snapshot(root);
	for (const { args, message } of refusals) {
		const result = init(root, args);
		assert.equal(result.status, 2, `${args.join(" ")}\n${result.output}`);
		assert.match(result.stderr, message, args.join(" "));
	}
	assert.equal(snapshot(root), before);
});

test("without arguments or a terminal, init prints usage and exits 2", (t) => {
	const root = repository(t);
	const result = init(root, []);
	assert.equal(result.status, 2);
	assert.match(result.stderr, /Usage/);
	assert.match(result.stderr, /--with nextjs,tailwind,database=postgresql/);
});

test("the catalog lists every language, add-on, and dialect", (t) => {
	const root = repository(t);
	const result = init(root, ["--list"]);
	assert.equal(result.status, 0);
	for (const name of [
		"python",
		"rust",
		"typescript",
		"react",
		"nextjs",
		"tailwind",
		"database",
	])
		assert.match(result.stdout, new RegExp(`^ {2}${name} `, "m"), name);
	assert.match(result.stdout, /database=postgresql: PostgreSQL/);
	assert.match(result.stdout, /database=sqlite: SQLite/);
	assert.match(result.stdout, /includes react/);
});

test("a dry run normalizes the selection, lists the files, and changes nothing", (t) => {
	const root = repository(t);
	const before = snapshot(root);
	const result = init(root, [
		"TypeScript,python",
		"--with",
		"tailwind,nextjs",
		"--dry-run",
	]);
	assert.equal(result.status, 0, result.output);
	assert.match(result.stdout, /Languages {4}python, typescript/);
	assert.match(
		result.stdout,
		/Add-ons {6}react \(included by nextjs\), nextjs, tailwind/,
	);
	assert.match(
		result.stdout,
		/Command {6}\.\/init\.sh python,typescript --with nextjs,tailwind/,
	);
	assert.match(result.stdout, /^ {2}postcss\.config\.mjs$/m);
	assert.match(result.stdout, /^ {2}tooling\/eslint-config\/react\.mjs$/m);
	assert.doesNotMatch(result.stdout, /^ {2}drizzle\.config\.ts$/m);
	assert.match(result.stdout, /Dry run: nothing changed/);
	assert.equal(snapshot(root), before);
});

test("a dry run reports why initialization would stop", (t) => {
	const root = repository(t);
	git(root, "checkout", "-qb", "feature");
	const result = init(root, ["rust", "--dry-run"]);
	assert.equal(result.status, 1);
	assert.match(
		result.stdout,
		/Initialization would stop now because:\n {2}branch must be main/,
	);
});

test("interactive mode re-asks after invalid answers and stops when declined", (t) => {
	const root = repository(t);
	const before = snapshot(root);
	const result = init(
		root,
		["--interactive"],
		"9\nts\n3\nnext\n2,4\n7\nsqlite\nn\n",
	);
	assert.equal(result.status, 1, result.output);
	assert.match(result.stderr, /9 is not one of the numbers above/);
	assert.match(result.stderr, /Did you mean 'typescript'\?/);
	assert.match(result.stderr, /Did you mean 'nextjs'\?/);
	assert.match(result.stderr, /Which database does the data layer target\?/);
	assert.match(
		result.stdout,
		/Command {6}\.\/init\.sh typescript --with nextjs,database=sqlite/,
	);
	assert.match(result.stderr, /init: nothing changed/);
	assert.equal(snapshot(root), before);
});

test("every add-on directory is in the init catalog", () => {
	const script = readFileSync(join(sourceRoot, "init.sh"), "utf8");
	const catalog = /^addons_catalog="([^"]+)"/m.exec(script)[1].split(" ");
	const addons = readdirSync(join(sourceRoot, "template", "addons")).filter(
		(name) => !name.includes("@") && !name.includes("+"),
	);
	assert.deepEqual([...addons].sort(), [...catalog].sort());
	for (const unit of readdirSync(join(sourceRoot, "template", "addons"))) {
		const members = unit.includes("+") ? unit.split("+") : [unit.split("@")[0]];
		for (const member of members)
			assert.ok(
				catalog.includes(member),
				`${unit} names unknown add-on ${member}`,
			);
	}
});
