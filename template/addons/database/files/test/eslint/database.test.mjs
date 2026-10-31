import assert from "node:assert/strict";
import { test } from "node:test";
import { ESLint } from "eslint";

const eslint = new ESLint({ overrideConfigFile: "eslint.config.mjs" });

async function ruleIds(code) {
	const [result] = await eslint.lintText(code, {
		filePath: "src/db/query-fixture.ts",
	});
	assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
	return result.messages.map((message) => message.ruleId);
}

test("sql.raw fails lint in application code", async () => {
	assert.deepEqual(
		await ruleIds(`import { sql } from "drizzle-orm";
export const byName = (name: string) => sql.raw(\`name = '\${name}'\`);
`),
		["no-restricted-syntax"],
	);
});

test("a bound sql template passes lint", async () => {
	assert.deepEqual(
		await ruleIds(`import { sql } from "drizzle-orm";
export const byName = (name: string) => sql\`name = \${name}\`;
`),
		[],
	);
});
