import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import RootLayout from "../../src/app/layout.tsx";
import Home from "../../src/app/page.tsx";

test("the home page renders its heading inside the root layout", () => {
	const html = renderToStaticMarkup(
		<RootLayout>
			<Home />
		</RootLayout>,
	);
	assert.match(
		html,
		/^<html lang="en">.*<body><main><h1>Generated product<\/h1>/,
	);
});
