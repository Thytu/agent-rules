import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
// agent-rules:addon-imports
import { housePlugin } from "./tooling/eslint-rules/index.mjs";

const product = [
	"app/**/*.{js,jsx,ts,tsx}",
	"src/**/*.{js,jsx,ts,tsx}",
	"test/**/*.{js,mjs,ts,tsx}",
];

const config = [
	{
		ignores: [
			"build/**",
			"dist/**",
			"coverage/**",
			"node_modules/**",
			"target/**",
			".venv/**",
			".agent-rules/**",
		],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	// agent-rules:addon-configs
	{
		files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
		rules: {
			complexity: ["error", 20],
			"@typescript-eslint/naming-convention": [
				"error",
				{
					selector: "variable",
					format: ["camelCase", "PascalCase"],
					leadingUnderscore: "allow",
				},
				{
					selector: "variable",
					modifiers: ["const"],
					format: ["camelCase", "PascalCase", "UPPER_CASE"],
					leadingUnderscore: "allow",
				},
				{
					selector: "function",
					format: ["camelCase", "PascalCase"],
				},
				{
					selector: "function",
					filter: {
						regex: "^(GET|HEAD|POST|PUT|DELETE|CONNECT|OPTIONS|TRACE|PATCH)$",
						match: true,
					},
					format: ["UPPER_CASE"],
				},
				{
					selector: "parameter",
					format: ["camelCase", "PascalCase"],
					leadingUnderscore: "allow",
				},
				{ selector: "typeLike", format: ["PascalCase"] },
			],
		},
	},
	{
		files: ["tooling/**/*.mjs", "test/**/*.mjs", "*.config.mjs"],
		languageOptions: { globals: { ...globals.node } },
	},
	{
		files: product,
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		plugins: { house: housePlugin },
		rules: {
			"no-restricted-properties": [
				"error",
				{
					object: "Object",
					property: "prototype",
					message:
						"Do not use Object.prototype for type checks; parse untrusted values with a schema.",
				},
			],
			"house/no-citation-comments": "error",
			"house/no-compat-shims": "error",
			"house/no-deferral-comments": "error",
			"house/no-generic-instanceof": "error",
			"house/no-long-comments": "error",
			"house/no-loose-variant-objects": "error",
			"house/no-runtime-typeof": "error",
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
				},
			],
		},
	},
	{
		files: ["test/**/*.{js,mjs,ts,tsx}"],
		plugins: { house: housePlugin },
		rules: { "house/meaningful-tests": "error" },
	},
];

export default config;
