import assert from "node:assert/strict";
import { test } from "node:test";
import { ESLint } from "eslint";

const eslint = new ESLint({ overrideConfigFile: "eslint.config.mjs" });
const paths = [
	"src/fixture.ts",
	"app/fixture.tsx",
	"test/fixture.test.ts",
	"tooling/fixture.mjs",
];

async function messages(code, filePath) {
	const [result] = await eslint.lintText(code, { filePath });
	assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
	return result.messages;
}

function branching(decisions) {
	const branches = Array.from(
		{ length: decisions },
		(_, index) => `\tif (flags[${index}]) total += 1;`,
	).join("\n");
	return `export function evaluate(flags) {\n\tlet total = 0;\n${branches}\n\treturn total;\n}\n`;
}

test("a function with complexity 20 passes lint everywhere", async () => {
	for (const filePath of paths)
		assert.deepEqual(await messages(branching(19), filePath), [], filePath);
});

test("a function with complexity 21 fails lint as an error everywhere", async () => {
	for (const filePath of paths) {
		const found = await messages(branching(20), filePath);
		assert.deepEqual(
			found.map(({ ruleId, severity }) => [ruleId, severity]),
			[["complexity", 2]],
			filePath,
		);
		assert.match(found[0].message, /complexity of 21.*allowed is 20/);
	}
});

test("a snake_case declaration fails the naming rule everywhere", async () => {
	for (const filePath of paths) {
		const found = await messages("export const session_count = 1;\n", filePath);
		assert.deepEqual(
			found.map(({ ruleId }) => ruleId),
			["@typescript-eslint/naming-convention"],
			filePath,
		);
		assert.match(found[0].message, /session_count/);
	}
});

test("conventional names and aliased boundary fields pass the naming rule", async () => {
	const found = await messages(
		`const MAX_BATCH_SIZE = 10;
type SessionSummary = { readonly sessionId: string };
export function GET() {
	return MAX_BATCH_SIZE;
}
export function readSession(payload: { session_id: string }): SessionSummary {
	const { session_id: sessionId } = payload;
	return { sessionId };
}
`,
		"src/fixture.ts",
	);
	assert.deepEqual(found, []);
});
