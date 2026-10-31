import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export const reactFiles = [
	"app/**/*.{js,jsx,ts,tsx}",
	"src/**/*.{js,jsx,ts,tsx}",
];

// Every recommended React, hooks, and accessibility rule as an error. A
// framework config that registers these plugins itself applies this set too.
export const reactRules = {
	...react.configs.flat.recommended.rules,
	...react.configs.flat["jsx-runtime"].rules,
	...jsxA11y.flatConfigs.recommended.rules,
	...reactHooks.configs.flat.recommended.rules,
	"react/prop-types": "off",
	"react-hooks/exhaustive-deps": "error",
	"react-hooks/incompatible-library": "error",
	"react-hooks/unsupported-syntax": "error",
};

const reactConfig = [
	{
		files: reactFiles,
		plugins: {
			react,
			"jsx-a11y": jsxA11y,
			"react-hooks": reactHooks,
		},
		languageOptions: react.configs.flat.recommended.languageOptions,
		settings: { react: { version: "detect" } },
		rules: reactRules,
	},
];

export default reactConfig;
