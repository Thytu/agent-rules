import assert from "node:assert/strict";
import { test } from "node:test";
import { ESLint } from "eslint";

const eslint = new ESLint({ overrideConfigFile: "eslint.config.mjs" });

async function tailwindRules(className) {
	const [result] = await eslint.lintText(
		`export function Badge() {
	return <span className="${className}">New</span>;
}
`,
		{ filePath: "src/badge-fixture.tsx" },
	);
	assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
	return result.messages.map((message) => message.ruleId);
}

test("a class Tailwind does not define fails lint", async () => {
	assert.deepEqual(await tailwindRules("text-hero-glow"), [
		"better-tailwindcss/no-unknown-classes",
	]);
});

test("two classes that set the same property fail lint", async () => {
	const rules = await tailwindRules("p-2 p-4");
	assert.ok(
		rules.includes("better-tailwindcss/no-conflicting-classes"),
		rules.join(", "),
	);
});

test("a raw color in an arbitrary value fails the design-token rule", async () => {
	assert.deepEqual(await tailwindRules("bg-[#ff0000]"), [
		"better-tailwindcss/no-restricted-classes",
	]);
});

test("ordered utilities from the theme pass lint", async () => {
	assert.deepEqual(await tailwindRules("flex items-center gap-2"), []);
});
