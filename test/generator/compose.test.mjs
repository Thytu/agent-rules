import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { isolatedEnvironment } from "./environment.mjs";
import { fileURLToPath } from "node:url";

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const compose = join(sourceRoot, "template", "init", "compose.mjs");

function fixture(t, addons) {
	const root = mkdtempSync(join(tmpdir(), "agent-rules-compose-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const write = (file, content) => {
		mkdirSync(dirname(join(root, file)), { recursive: true });
		writeFileSync(
			join(root, file),
			typeof content === "string" ? content : `${JSON.stringify(content)}\n`,
		);
	};
	write("out/package.json", {
		name: "product",
		scripts: { test: "base" },
		devDependencies: { zeta: "1.0.0", alpha: "1.0.0" },
		knip: { entry: ["test/**"] },
	});
	write(
		"out/eslint.config.mjs",
		"import base from 'base';\n// agent-rules:addon-imports\nconst config = [\n\tbase,\n\t// agent-rules:addon-configs\n];\nexport default config;\n",
	);
	write(
		"out/scripts/verify-typescript.sh",
		"# agent-rules:addon-env\nlint\n\t# agent-rules:addon-checks\naudit\n# agent-rules:addon-full-checks\n",
	);
	for (const [unit, files] of Object.entries(addons))
		for (const [file, content] of Object.entries(files))
			write(`template/addons/${unit}/${file}`, content);
	const run = (...args) =>
		spawnSync(process.execPath, [compose, ...args], {
			encoding: "utf8",
			env: isolatedEnvironment,
		});
	const read = (file) => readFileSync(join(root, file), "utf8");
	return {
		root,
		run,
		read,
		template: join(root, "template"),
		out: join(root, "out"),
	};
}

test("fragments merge objects, extend arrays, and keep dependencies sorted", (t) => {
	const f = fixture(t, {
		alpha: {
			"package.json": {
				devDependencies: { middle: "2.0.0" },
				knip: { entry: ["tooling/a.mjs"] },
			},
		},
		beta: {
			"package.json": {
				scripts: { test: "beta" },
				knip: { entry: ["test/**", "tooling/b.mjs"] },
			},
		},
	});
	const result = f.run("apply", f.template, f.out, "alpha", "beta");
	assert.equal(result.status, 0, result.stderr);
	const manifest = JSON.parse(f.read("out/package.json"));
	assert.deepEqual(Object.keys(manifest.devDependencies), [
		"alpha",
		"middle",
		"zeta",
	]);
	assert.deepEqual(manifest.knip.entry, [
		"test/**",
		"tooling/a.mjs",
		"tooling/b.mjs",
	]);
	assert.equal(manifest.scripts.test, "beta");
});

test("two add-ons that disagree on a value are a template error", (t) => {
	const f = fixture(t, {
		alpha: { "package.json": { scripts: { build: "alpha build" } } },
		beta: { "package.json": { scripts: { build: "beta build" } } },
	});
	const result = f.run("apply", f.template, f.out, "alpha", "beta");
	assert.equal(result.status, 1);
	assert.match(
		result.stderr,
		/beta and alpha set different values for scripts\.build/,
	);
});

test("markers render add-on configs and gate steps, and vanish without add-ons", (t) => {
	const f = fixture(t, {
		"next-app": {
			"verify.env": "export TELEMETRY=0\n",
			"verify.full": "build\n",
		},
		db: { "verify.commit": "db check\n" },
	});
	mkdirSync(join(f.out, "tooling", "eslint-config"), { recursive: true });
	writeFileSync(
		join(f.out, "tooling", "eslint-config", "next-app.mjs"),
		"export default [];\n",
	);
	const result = f.run("apply", f.template, f.out, "next-app", "db");
	assert.equal(result.status, 0, result.stderr);
	assert.equal(
		f.read("out/eslint.config.mjs"),
		"import base from 'base';\nimport nextAppConfig from \"./tooling/eslint-config/next-app.mjs\";\nconst config = [\n\tbase,\n\t...nextAppConfig,\n];\nexport default config;\n",
	);
	assert.equal(
		f.read("out/scripts/verify-typescript.sh"),
		'export TELEMETRY=0\nlint\n\tdb check\naudit\nif [ "$mode" = full ]; then\n\tbuild\nfi\n',
	);
});

test("a combination can skip a member's ESLint config", (t) => {
	const f = fixture(t, { "a+b": { "addon.conf": "eslint_skip=a\n" } });
	mkdirSync(join(f.out, "tooling", "eslint-config"), { recursive: true });
	for (const unit of ["a", "b"])
		writeFileSync(
			join(f.out, "tooling", "eslint-config", `${unit}.mjs`),
			"export default [];\n",
		);
	const result = f.run("apply", f.template, f.out, "a", "b", "a+b");
	assert.equal(result.status, 0, result.stderr);
	const config = f.read("out/eslint.config.mjs");
	assert.doesNotMatch(config, /aConfig/);
	assert.match(config, /\.\.\.bConfig,/);
});

test("the superset rejects two units pinning different versions", (t) => {
	const f = fixture(t, {
		alpha: { "package.json": { dependencies: { shared: "1.0.0" } } },
		beta: { "package.json": { devDependencies: { shared: "2.0.0" } } },
	});
	mkdirSync(join(f.template, "typescript", "files"), { recursive: true });
	writeFileSync(
		join(f.template, "typescript", "files", "package.json"),
		'{"name":"base"}\n',
	);
	const result = f.run("superset", f.template, join(f.root, "superset.json"));
	assert.equal(result.status, 1);
	assert.match(
		result.stderr,
		/beta pins shared@2\.0\.0; another unit pins 1\.0\.0/,
	);
});
