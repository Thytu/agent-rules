import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { z } from "zod";

// Enforces bundle-budgets.json against the Turbopack analyzer output written by
// `pnpm bundle:analyze`: client bytes per route and browser bytes per package.
const bytes = z.number().int().nonnegative();
const routeLimits = z
	.object({ maxBytes: bytes.positive(), maxCompressedBytes: bytes.positive() })
	.strict();
const budgetSchema = z
	.object({
		defaultRoute: routeLimits,
		routes: z.record(z.string().startsWith("/"), routeLimits),
		defaultPackageMaxBytes: bytes.positive(),
		packages: z.record(z.string(), bytes.positive()),
	})
	.strict();
const summariesSchema = z
	.array(
		z.object({
			route: z.string().startsWith("/"),
			client: z.object({ size: bytes, compressed_size: bytes }),
		}),
	)
	.nonempty();
const recordSchema = z.object({ type: z.string() }).passthrough();
const metaSchema = z.object({
	schema_version: z.literal(1),
	route_count: bytes.positive(),
	selected_routes: bytes.positive(),
});
const routeSchema = z.object({ route: z.string().startsWith("/") });
const partSchema = z.object({
	filename: z.string(),
	source_path: z.string(),
	size: bytes,
});

function packageName(sourcePath) {
	const marker = "/node_modules/";
	const index = sourcePath.lastIndexOf(marker);
	if (index < 0) return undefined;
	const segments = sourcePath.slice(index + marker.length).split("/");
	return segments.slice(0, segments[0].startsWith("@") ? 2 : 1).join("/");
}

async function packageSizes(graphPath) {
	const packages = new Map();
	const seen = new Set();
	const routes = new Set();
	let metadata;
	const lines = readline.createInterface({
		input: fs.createReadStream(graphPath, { encoding: "utf8" }),
		crlfDelay: Infinity,
	});
	for await (const line of lines) {
		const record = recordSchema.parse(JSON.parse(line));
		if (record.type === "meta") {
			if (metadata) throw new Error("the analyzer graph has two meta records");
			metadata = metaSchema.parse(record);
		} else if (record.type === "route") {
			const { route } = routeSchema.parse(record);
			if (routes.has(route))
				throw new Error(`duplicate analyzer route ${route}`);
			routes.add(route);
		} else if (record.type === "part") {
			const part = partSchema.parse(record);
			const key = `${part.filename}\0${part.source_path}`;
			const name = packageName(part.source_path);
			if (!part.filename.startsWith("[client-fs]/") || seen.has(key) || !name)
				continue;
			seen.add(key);
			packages.set(name, (packages.get(name) ?? 0) + part.size);
		}
	}
	if (
		!metadata ||
		metadata.selected_routes !== metadata.route_count ||
		routes.size !== metadata.route_count
	)
		throw new Error("expected a complete, unfiltered analyzer export");
	return packages;
}

function cell(value) {
	return String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll("|", "&#124;")
		.replaceAll(/[\r\n]/g, " ");
}

async function main() {
	const directory = path.resolve(".next/diagnostics/analyze");
	const budgets = budgetSchema.parse(
		JSON.parse(fs.readFileSync("bundle-budgets.json", "utf8")),
	);
	const summaries = summariesSchema.parse(
		JSON.parse(
			fs.readFileSync(
				path.join(directory, "data/route-summaries.json"),
				"utf8",
			),
		),
	);
	const packages = await packageSizes(
		path.join(directory, "bundle-graph.jsonl"),
	);
	const violations = [];
	const report = [
		"## Client bundle budgets",
		"",
		"Analyzer bytes per route, including async imports and shared code. Compressed bytes are analyzer estimates, not transfer sizes.",
		"",
		"| Route | Bytes / limit | Compressed / limit | Result |",
		"| --- | ---: | ---: | --- |",
	];
	const clientRoutes = summaries
		.filter(({ client }) => client.size > 0)
		.sort((left, right) => right.client.size - left.client.size);
	for (const { route, client } of clientRoutes) {
		const limits = budgets.routes[route] ?? budgets.defaultRoute;
		const failed =
			client.size > limits.maxBytes ||
			client.compressed_size > limits.maxCompressedBytes;
		if (failed) violations.push(`route ${route} exceeds its client budget`);
		report.push(
			`| ${cell(route)} | ${client.size} / ${limits.maxBytes} | ${client.compressed_size} / ${limits.maxCompressedBytes} | ${failed ? "FAIL" : "pass"} |`,
		);
	}
	report.push(
		"",
		"| Browser package | Bytes / limit | Result |",
		"| --- | ---: | --- |",
	);
	for (const [name, size] of [...packages].sort((a, b) => b[1] - a[1])) {
		const limit = budgets.packages[name] ?? budgets.defaultPackageMaxBytes;
		const failed = size > limit;
		if (failed) violations.push(`package ${name} exceeds its browser budget`);
		report.push(
			`| ${cell(name)} | ${size} / ${limit} | ${failed ? "FAIL" : "pass"} |`,
		);
	}
	report.push(
		"",
		"Before raising a budget, look for a narrower import, server-only placement, or a lighter dependency. The analyzer report is in .next/diagnostics/analyze/.",
		"",
	);
	const markdown = report.join("\n");
	if (process.env.GITHUB_STEP_SUMMARY)
		fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
	console.log(markdown);
	if (violations.length > 0) throw new Error(violations.join("\n"));
}

try {
	await main();
} catch (error) {
	console.error(`bundle-budgets: ${error.message}`);
	process.exitCode = 1;
}
