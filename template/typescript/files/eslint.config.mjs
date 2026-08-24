import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { housePlugin } from "./tooling/eslint-rules/index.mjs";

const product = [
	"app/**/*.{js,jsx,ts,tsx}",
	"src/**/*.{js,jsx,ts,tsx}",
	"test/**/*.{js,mjs,ts,tsx}",
];

export default [
	{
		ignores: [
			"build/**",
			"dist/**",
			"coverage/**",
			"node_modules/**",
			".agent-rules/**",
		],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ["tooling/**/*.mjs", "test/**/*.mjs", "*.config.mjs"],
		languageOptions: { globals: { ...globals.node } },
	},
	{
		files: product,
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		plugins: { house: housePlugin },
		rules: {
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
