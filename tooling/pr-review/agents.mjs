// Full-coverage reviewer: one focused agent per rule doc in docs/rules/, plus
// stack profiles whose repository marker exists. Rules are discovered rather
// than hand-listed. Each agent loads its document verbatim at review time, so
// required rule coverage cannot drift from the mapped source documents.
//
// Purely-procedural rules (git append-only, squash-merge, verify-before-commit)
// aren't checkable from a PR diff and stay hook/CI-enforced — they aren't docs
// here by design.
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(HERE, "..", "..");
export const RULES_DIR = join(REPO_ROOT, "docs", "rules");

export function loadAgents(root = REPO_ROOT) {
	const rulesDir = root === REPO_ROOT ? RULES_DIR : join(root, "docs", "rules");
	const agents = readdirSync(rulesDir)
		.filter((file) => file.endsWith(".md"))
		.map((file) => ({
			id: file.replace(/\.md$/, ""),
			doc: `docs/rules/${file}`,
		}));

	if (existsSync(join(root, "Cargo.toml"))) {
		agents.push({ id: "rust", doc: "docs/profiles/rust.md" });
	}

	return agents.sort((left, right) => left.id.localeCompare(right.id));
}
