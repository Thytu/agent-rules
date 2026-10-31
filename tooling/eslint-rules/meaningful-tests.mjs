// The mechanical subset of docs/rules/testing.md. A test
// that asserts nothing, only asserts mock calls, snapshots to a file, checks an
// imported constant against its own literal, or mocks a sibling module can
// never catch a regression — it re-proves the implementation to itself.
const CALL_MATCHERS = new Set([
	"toHaveBeenCalled",
	"toHaveBeenCalledWith",
	"toHaveBeenCalledTimes",
	"toHaveBeenCalledOnce",
	"toHaveBeenLastCalledWith",
	"toHaveBeenNthCalledWith",
	"toBeCalled",
	"toBeCalledWith",
	"toBeCalledTimes",
]);
const LITERAL_MATCHERS = new Set(["toContain", "toBe", "toEqual", "toMatch"]);
const TEST_FNS = new Set(["it", "test"]);

function isTestCall(node) {
	const c = node.callee;
	if (c.type === "Identifier" && TEST_FNS.has(c.name)) return true;
	return (
		c.type === "MemberExpression" &&
		c.object.type === "Identifier" &&
		TEST_FNS.has(c.object.name)
	);
}

/** For `expect(x).not.foo()` chains: returns { matcher, arg } or null. */
function expectChain(node) {
	if (node.callee.type !== "MemberExpression") return null;
	const matcher = node.callee.property;
	if (matcher.type !== "Identifier") return null;
	let obj = node.callee.object;
	while (obj.type === "MemberExpression") obj = obj.object;
	if (
		obj.type === "CallExpression" &&
		obj.callee.type === "Identifier" &&
		obj.callee.name === "expect"
	) {
		return { matcher: matcher.name, expectArg: obj.arguments[0] };
	}
	return null;
}

function isImportedIdentifier(node, scope) {
	if (!node || node.type !== "Identifier") return false;
	let s = scope;
	while (s) {
		const variable = s.variables.find((v) => v.name === node.name);
		if (variable) return variable.defs.some((d) => d.type === "ImportBinding");
		s = s.upper;
	}
	return false;
}

function isIdentifier(node, name) {
	return node?.type === "Identifier" && node.name === name;
}

function isMemberCall(callee, object, property) {
	return (
		callee.type === "MemberExpression" &&
		isIdentifier(callee.object, object) &&
		isIdentifier(callee.property, property)
	);
}

// node:assert calls and RuleTester runs are outcome assertions.
function isAssertCall(callee) {
	if (isIdentifier(callee, "assert")) return true;
	return (
		(callee.type === "MemberExpression" &&
			isIdentifier(callee.object, "assert")) ||
		isMemberCall(callee, "ruleTester", "run")
	);
}

function isViMock(callee) {
	return isMemberCall(callee, "vi", "mock");
}

function isLocalSpecifier(spec) {
	return (
		spec?.type === "Literal" &&
		typeof spec.value === "string" &&
		(spec.value.startsWith(".") || spec.value.startsWith("~"))
	);
}

function countAssertion(current, observesOutcome) {
	if (!current) return;
	current.expects += 1;
	if (observesOutcome) current.nonCallExpects += 1;
}

function reportExpectChain(context, node, chain) {
	if (
		chain.matcher === "toMatchSnapshot" ||
		chain.matcher === "toMatchFileSnapshot"
	) {
		context.report({ node, messageId: "externalSnapshot" });
	}
	if (
		LITERAL_MATCHERS.has(chain.matcher) &&
		isImportedIdentifier(chain.expectArg, context.sourceCode.getScope(node)) &&
		node.arguments[0]?.type === "Literal" &&
		typeof node.arguments[0].value === "string"
	) {
		context.report({ node, messageId: "importedLiteral" });
	}
}

export const meaningfulTests = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Ban mechanically-detectable proof-of-work tests: zero assertions, mock-call-only assertions, file snapshots, imported-literal assertions, sibling-module mocks.",
		},
		schema: [],
		messages: {
			noAssertions:
				"Test has no expect() — it can never fail, so it proves nothing. Assert an observable outcome (return value, thrown error, response, DB state). See docs/rules/testing.md.",
			callAssertionsOnly:
				"Every assertion here is a mock-call check — that verifies wiring, not behavior, and passes while the behavior is broken. Add an outcome assertion; call checks may only corroborate it. See docs/rules/testing.md.",
			externalSnapshot:
				"File snapshots are banned — they rubber-stamp whatever the code produced. Use an explicit assertion, or toMatchInlineSnapshot only where the full wire shape IS the contract. See docs/rules/testing.md.",
			importedLiteral:
				"This asserts an imported constant contains its own source literal — it fires on every deliberate edit and catches nothing. Test behavior (shape, leak, budget invariants), not copy. See docs/rules/testing.md.",
			siblingMock:
				"vi.mock of a local module fakes the thing you should be testing. Mock only process boundaries (providers, third-party SDKs, the clock); use the real module or promote to an integration test. See docs/rules/testing.md.",
		},
	},
	create(context) {
		const testStack = [];
		const currentTest = () => testStack[testStack.length - 1];
		return {
			CallExpression(node) {
				if (isTestCall(node)) {
					testStack.push({ node, expects: 0, nonCallExpects: 0 });
				} else if (isAssertCall(node.callee)) {
					countAssertion(currentTest(), true);
				} else if (isViMock(node.callee)) {
					if (isLocalSpecifier(node.arguments[0]))
						context.report({ node, messageId: "siblingMock" });
				} else {
					const chain = expectChain(node);
					if (!chain) return;
					countAssertion(currentTest(), !CALL_MATCHERS.has(chain.matcher));
					reportExpectChain(context, node, chain);
				}
			},
			"CallExpression:exit"(node) {
				const current = testStack[testStack.length - 1];
				if (!current || current.node !== node) return;
				testStack.pop();
				if (current.expects === 0) {
					context.report({ node, messageId: "noAssertions" });
				} else if (current.nonCallExpects === 0) {
					context.report({ node, messageId: "callAssertionsOnly" });
				}
			},
		};
	},
};
