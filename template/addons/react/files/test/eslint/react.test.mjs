import assert from "node:assert/strict";
import { test } from "node:test";
import { ESLint } from "eslint";

const eslint = new ESLint({ overrideConfigFile: "eslint.config.mjs" });

async function lint(code) {
	const [result] = await eslint.lintText(code, {
		filePath: "src/component-fixture.tsx",
	});
	assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
	return result.messages;
}

// A framework config may report more; each case pins the React rule it owns
// and requires it to be an error.
function reported(messages, ruleId) {
	return messages.find((message) => message.ruleId === ruleId);
}

test("an effect that omits a dependency fails lint", async () => {
	const messages = await lint(`import { useEffect } from "react";
export function Title({ title }: { title: string }) {
	useEffect(() => {
		document.title = title;
	}, []);
	return null;
}
`);
	const found = reported(messages, "react-hooks/exhaustive-deps");
	assert.equal(found?.severity, 2, JSON.stringify(messages));
	assert.match(found.message, /missing dependency: 'title'/);
});

test("state derived inside an effect fails lint", async () => {
	const messages = await lint(`import { useEffect, useState } from "react";
export function Total({ prices }: { prices: number[] }) {
	const [total, setTotal] = useState(0);
	useEffect(() => {
		setTotal(prices.reduce((sum, price) => sum + price, 0));
	}, [prices]);
	return <p>{total}</p>;
}
`);
	assert.equal(
		reported(messages, "react-hooks/set-state-in-effect")?.severity,
		2,
		JSON.stringify(messages),
	);
});

test("a hook called conditionally fails lint", async () => {
	const messages = await lint(`import { useState } from "react";
export function Toggle({ enabled }: { enabled: boolean }) {
	if (!enabled) return null;
	const [open, setOpen] = useState(false);
	return <button type="button" onClick={() => setOpen(!open)}>Toggle</button>;
}
`);
	assert.equal(
		reported(messages, "react-hooks/rules-of-hooks")?.severity,
		2,
		JSON.stringify(messages),
	);
});

test("an image without a text alternative fails accessibility lint", async () => {
	const messages = await lint(`export function Logo() {
	return <img src="/logo.png" />;
}
`);
	assert.equal(
		reported(messages, "jsx-a11y/alt-text")?.severity,
		2,
		JSON.stringify(messages),
	);
});

test("an effect with complete dependencies and cleanup passes lint", async () => {
	const messages = await lint(`import { useEffect } from "react";
export function FocusTitle({ title }: { title: string }) {
	useEffect(() => {
		const update = () => {
			document.title = title;
		};
		window.addEventListener("focus", update);
		return () => window.removeEventListener("focus", update);
	}, [title]);
	return <p>{title}</p>;
}
`);
	assert.deepEqual(messages, []);
});
