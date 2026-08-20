import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { housePlugin } from "./tooling/eslint-rules/index.mjs";

const SRC = [
	"app/**/*.{js,jsx,ts,tsx}",
	"src/**/*.{js,jsx,ts,tsx}",
	"test/**/*.{js,ts}",
];

export default [
	{
		ignores: [
			"build/**",
			"dist/**",
			"coverage/**",
			"node_modules/**",
			"docs/**",
			".agents/**",
			".claude/**",
			"*.config.{js,mjs,ts}",
		],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ["tooling/**/*.mjs"],
		languageOptions: { globals: { ...globals.node } },
	},
	{
		files: SRC,
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
		files: ["test/**/*.{js,ts}"],
		plugins: { house: housePlugin },
		rules: { "house/meaningful-tests": "error" },
	},
];
