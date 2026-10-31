// Composes the TypeScript output of an initialization from the selected units.
// A unit is an add-on directory under TEMPLATE/addons: an add-on ("react"), a
// variant for one parameter value ("database@sqlite"), or a combination applied
// when all its members are selected ("nextjs+tailwind"). init.sh orders them.
import fs from "node:fs";
import path from "node:path";

const fragments = ["package.json", "tsconfig.json", "biome.json", ".c8rc.json"];
const dependencySections = [
	"dependencies",
	"devDependencies",
	"optionalDependencies",
];

function readJson(file) {
	return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
	fs.writeFileSync(file, `${JSON.stringify(value, null, "\t")}\n`);
}

function isObject(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Objects merge key by key and arrays gain the items they lack. A scalar from a
// unit replaces the base value, but two units may not disagree on one: that is
// a conflict in the template, reported instead of resolved by order.
function merge(target, source, owners, unit, trail) {
	for (const [key, value] of Object.entries(source)) {
		const where = [...trail, key].join(".");
		if (isObject(value) && isObject(target[key])) {
			merge(target[key], value, owners, unit, [...trail, key]);
		} else if (Array.isArray(value) && Array.isArray(target[key])) {
			for (const item of value)
				if (
					!target[key].some(
						(existing) => JSON.stringify(existing) === JSON.stringify(item),
					)
				)
					target[key].push(item);
		} else {
			const owner = owners.get(where);
			if (
				owner !== undefined &&
				JSON.stringify(target[key]) !== JSON.stringify(value)
			)
				throw new Error(
					`${unit} and ${owner} set different values for ${where}`,
				);
			target[key] = structuredClone(value);
			owners.set(where, unit);
		}
	}
}

function sortDependencies(manifest) {
	for (const section of dependencySections)
		if (isObject(manifest[section]))
			manifest[section] = Object.fromEntries(
				Object.entries(manifest[section]).sort(([left], [right]) =>
					left.localeCompare(right),
				),
			);
}

function mergeFragments(template, out, units) {
	for (const name of fragments) {
		const target = path.join(out, name);
		const sources = units
			.map((unit) => [unit, path.join(template, "addons", unit, name)])
			.filter(([, file]) => fs.existsSync(file));
		if (sources.length === 0) continue;
		if (!fs.existsSync(target))
			throw new Error(`${name} fragment has no base file to merge into`);
		const merged = readJson(target);
		const owners = new Map();
		for (const [unit, file] of sources)
			merge(merged, readJson(file), owners, unit, []);
		if (name === "package.json") sortDependencies(merged);
		writeJson(target, merged);
	}
}

function lines(file) {
	if (!fs.existsSync(file)) return [];
	return fs
		.readFileSync(file, "utf8")
		.split("\n")
		.filter((line) => line.trim() !== "");
}

function fillMarker(file, marker, replacement) {
	const text = fs.readFileSync(file, "utf8").split("\n");
	const index = text.findIndex((line) => line.trim() === marker);
	if (index < 0) throw new Error(`${path.basename(file)} has no ${marker}`);
	const indent = text[index].slice(0, text[index].indexOf(marker));
	text.splice(index, 1, ...replacement.map((line) => `${indent}${line}`));
	fs.writeFileSync(file, text.join("\n"));
}

function eslintName(unit) {
	return `${unit.replace(/[^a-z0-9]+([a-z0-9])/g, (_, letter) => letter.toUpperCase())}Config`;
}

function conf(template, unit, key) {
	const file = path.join(template, "addons", unit, "addon.conf");
	if (!fs.existsSync(file)) return [];
	const line = fs
		.readFileSync(file, "utf8")
		.split("\n")
		.find((entry) => entry.startsWith(`${key}=`));
	return line
		? line
				.slice(key.length + 1)
				.split(",")
				.filter(Boolean)
		: [];
}

// A combination may skip an add-on's config when another config in the
// selection already registers its plugins (see nextjs+react).
function renderEslint(template, out, units) {
	const file = path.join(out, "eslint.config.mjs");
	const skipped = new Set(
		units.flatMap((unit) => conf(template, unit, "eslint_skip")),
	);
	const configs = units.filter(
		(unit) =>
			!skipped.has(unit) &&
			fs.existsSync(path.join(out, "tooling", "eslint-config", `${unit}.mjs`)),
	);
	fillMarker(
		file,
		"// agent-rules:addon-imports",
		configs.map(
			(unit) =>
				`import ${eslintName(unit)} from "./tooling/eslint-config/${unit}.mjs";`,
		),
	);
	fillMarker(
		file,
		"// agent-rules:addon-configs",
		configs.map((unit) => `...${eslintName(unit)},`),
	);
}

function renderVerify(template, out, units) {
	const file = path.join(out, "scripts", "verify-typescript.sh");
	const collect = (name) =>
		units.flatMap((unit) => lines(path.join(template, "addons", unit, name)));
	fillMarker(file, "# agent-rules:addon-env", collect("verify.env"));
	fillMarker(file, "# agent-rules:addon-checks", collect("verify.commit"));
	const full = collect("verify.full");
	fillMarker(
		file,
		"# agent-rules:addon-full-checks",
		full.length === 0
			? []
			: [
					'if [ "$mode" = full ]; then',
					...full.map((line) => `\t${line}`),
					"fi",
				],
	);
}

// The superset manifest declares every dependency any selection can need, so a
// single committed lockfile pins them all; init prunes it to the selection.
function superset(template, file) {
	const addons = path.join(template, "addons");
	const units = fs
		.readdirSync(addons)
		.filter((unit) => fs.existsSync(path.join(addons, unit, "package.json")))
		.sort();
	const manifest = readJson(
		path.join(template, "typescript", "files", "package.json"),
	);
	for (const unit of units) {
		const fragment = readJson(path.join(addons, unit, "package.json"));
		for (const section of dependencySections) {
			if (!isObject(fragment[section])) continue;
			manifest[section] ??= {};
			for (const [name, version] of Object.entries(fragment[section])) {
				const pinned = Object.entries(manifest)
					.filter(([key]) => dependencySections.includes(key))
					.map(([, deps]) => deps[name])
					.find((existing) => existing !== undefined);
				if (pinned !== undefined && pinned !== version)
					throw new Error(
						`${unit} pins ${name}@${version}; another unit pins ${pinned}`,
					);
				manifest[section][name] = version;
			}
		}
	}
	sortDependencies(manifest);
	writeJson(file, manifest);
}

const [command, template, target, ...units] = process.argv.slice(2);
try {
	if (command === "apply") {
		mergeFragments(template, target, units);
		renderEslint(template, target, units);
		renderVerify(template, target, units);
	} else if (command === "superset") {
		superset(template, target);
	} else {
		throw new Error(
			"usage: compose.mjs apply TEMPLATE OUT UNIT... | superset TEMPLATE FILE",
		);
	}
} catch (error) {
	console.error(`compose: ${error.message}`);
	process.exit(1);
}
