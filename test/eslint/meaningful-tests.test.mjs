import { test } from "node:test";
import { RuleTester } from "eslint";
import tseslint from "typescript-eslint";
import { meaningfulTests } from "../../tooling/eslint-rules/meaningful-tests.mjs";

const ruleTester = new RuleTester({
	languageOptions: { parser: tseslint.parser, sourceType: "module" },
});

test("a test without any assertion reports", () => {
	ruleTester.run("meaningful-tests", meaningfulTests, {
		valid: [
			"test('adds', () => { assert.equal(add(1, 2), 3); });",
			"test('adds', () => { assert(add(1, 2) === 3); });",
			"it('adds', () => { expect(add(1, 2)).toBe(3); });",
			"test.skip('later', () => { expect(add(1, 2)).not.toBe(4); });",
			"test('rule', () => { ruleTester.run('r', rule, { valid: [], invalid: [] }); });",
		],
		invalid: [
			{
				code: "test('adds', () => { add(1, 2); });",
				errors: [{ messageId: "noAssertions" }],
			},
			{
				code: "it.only('adds', async () => { await add(1, 2); });",
				errors: [{ messageId: "noAssertions" }],
			},
		],
	});
});

test("a test whose only assertions are mock calls reports", () => {
	ruleTester.run("meaningful-tests", meaningfulTests, {
		valid: [
			"test('sends', () => { send(); expect(fetch).toHaveBeenCalled(); expect(result()).toBe(1); });",
		],
		invalid: [
			{
				code: "test('sends', () => { send(); expect(fetch).toHaveBeenCalledWith('/x'); expect(log).toBeCalledTimes(1); });",
				errors: [{ messageId: "callAssertionsOnly" }],
			},
		],
	});
});

test("file snapshots and imported literals report", () => {
	ruleTester.run("meaningful-tests", meaningfulTests, {
		valid: [
			"test('shape', () => { expect(render()).toMatchInlineSnapshot(); });",
			"const local = 'x'; test('copy', () => { expect(local).toContain('x'); });",
			"import { PROMPT } from './prompt'; test('length', () => { expect(PROMPT.length).toBe(3); });",
		],
		invalid: [
			{
				code: "test('shape', () => { expect(render()).toMatchSnapshot(); });",
				errors: [{ messageId: "externalSnapshot" }],
			},
			{
				code: "test('shape', () => { expect(render()).toMatchFileSnapshot('a.snap'); });",
				errors: [{ messageId: "externalSnapshot" }],
			},
			{
				code: "import { PROMPT } from './prompt'; test('copy', () => { expect(PROMPT).toContain('Be brief'); });",
				errors: [{ messageId: "importedLiteral" }],
			},
		],
	});
});

test("mocking a sibling module reports while boundary mocks pass", () => {
	ruleTester.run("meaningful-tests", meaningfulTests, {
		valid: ["vi.mock('openai');", "vi.mock(`./${name}`);", "vi.mock(path);"],
		invalid: [
			{
				code: "vi.mock('./repository');",
				errors: [{ messageId: "siblingMock" }],
			},
			{
				code: "vi.mock('~/lib/clock');",
				errors: [{ messageId: "siblingMock" }],
			},
		],
	});
});
