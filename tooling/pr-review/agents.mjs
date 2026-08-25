// Full-coverage reviewer: one focused agent per top-level docs/rules document.
// Every owner loads its document verbatim and reviews the whole pull request.
// The fixed budget prevents an added file from silently increasing production
// and evaluation model calls.
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(HERE, "..", "..");
export const RULES_DIR = join(REPO_ROOT, "docs", "rules");
export const OWNER_BUDGET = 8;

export function loadAgents(root = REPO_ROOT) {
	const rulesDir = root === REPO_ROOT ? RULES_DIR : join(root, "docs", "rules");
	const agents = readdirSync(rulesDir)
		.filter((file) => file.endsWith(".md"))
		.map((file) => ({
			id: file.replace(/\.md$/, ""),
			doc: `docs/rules/${file}`,
		}))
		.sort((left, right) => left.id.localeCompare(right.id));
	if (agents.length !== OWNER_BUDGET) {
		throw new Error(
			`rule owner count ${agents.length} does not match declared budget ${OWNER_BUDGET}`,
		);
	}
	return agents;
}
