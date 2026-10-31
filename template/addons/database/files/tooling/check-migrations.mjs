import { execFileSync } from "node:child_process";
import fs from "node:fs";

// Applied migrations are history: databases that already ran a migration never
// run an edited copy. Committed migrations, their snapshots, and the existing
// journal entries are therefore append-only.
const migrations = "db/migrations";
const journal = `${migrations}/meta/_journal.json`;

function git(...args) {
	return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function revisionExists(revision) {
	try {
		git("rev-parse", "--verify", "--quiet", `${revision}^{commit}`);
		return true;
	} catch {
		return false;
	}
}

function readAt(revision, path) {
	try {
		return git("show", `${revision}:${path}`);
	} catch {
		return undefined;
	}
}

function journalEntries(text) {
	return JSON.parse(text).entries.map((entry) => JSON.stringify(entry));
}

// Compares the committed state at `base` with the staged tree (the commit being
// made) and, when given, a later revision.
function rewrites(base, target) {
	const range = target ? [base, target] : ["--cached", base];
	const changed = git(
		"diff",
		"--name-status",
		"--no-renames",
		...range,
		"--",
		migrations,
	);
	const errors = [];
	for (const line of changed.split("\n").filter(Boolean)) {
		const [status, path] = line.split("\t");
		if (status === "A") continue;
		if (path === journal && status === "M") {
			const before = journalEntries(readAt(base, path));
			const after = journalEntries(
				target ? readAt(target, path) : git("show", `:${path}`),
			);
			const kept = before.every((entry, index) => after[index] === entry);
			if (kept && after.length >= before.length) continue;
			errors.push(`${path}: existing journal entries were changed or removed`);
			continue;
		}
		errors.push(
			`${path}: an applied migration was ${status === "D" ? "deleted" : "modified"}`,
		);
	}
	return errors;
}

if (!fs.existsSync(migrations)) {
	console.log("check-migrations: no migrations yet");
	process.exit(0);
}

// drizzle-kit validates the journal and snapshots; it creates the migrations
// folder when it is missing, so it runs only once migrations exist.
execFileSync("drizzle-kit", ["check"], { stdio: "inherit", timeout: 120_000 });

const errors = [];
if (revisionExists("HEAD")) errors.push(...rewrites("HEAD"));
// Before a push, check every commit on the branch against its parent, which
// catches a rewrite committed without the commit gate, including an edit to a
// migration the branch itself added earlier.
if (revisionExists("origin/main") && revisionExists("HEAD")) {
	const base = git("merge-base", "origin/main", "HEAD");
	const commits = git(
		"rev-list",
		"--reverse",
		`${base}..HEAD`,
		"--",
		migrations,
	);
	for (const commit of commits.split("\n").filter(Boolean))
		for (const error of rewrites(`${commit}^`, commit))
			errors.push(`${commit.slice(0, 7)} ${error}`);
} else {
	console.log(
		"check-migrations: skipped the comparison with origin/main, which this checkout does not have",
	);
}

if (errors.length > 0) {
	console.error([...new Set(errors)].join("\n"));
	console.error(
		"check-migrations: never edit or delete a committed migration. Restore it and generate a new migration with `pnpm db:generate` that moves the schema forward.",
	);
	process.exit(1);
}
console.log("check-migrations: committed migrations are unchanged");
