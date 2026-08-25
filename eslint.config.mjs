import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { housePlugin } from "./tooling/eslint-rules/index.mjs";

export default [
	{
		ignores: [
			"build/**",
			"dist/**",
			"coverage/**",
			"node_modules/**",
			".agent-rules/**",
			"template/**",
		],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ["tooling/**/*.mjs", "test/**/*.mjs", "*.config.mjs"],
		languageOptions: { globals: { ...globals.node } },
	},
	{
		files: ["test/**/*.{js,mjs,ts,tsx}"],
		languageOptions: { globals: { ...globals.node } },
		plugins: { house: housePlugin },
		rules: { "house/meaningful-tests": "error" },
	},
];
