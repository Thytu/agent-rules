import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import { getDefaultSelectors } from "eslint-plugin-better-tailwindcss/defaults";

const files = ["app/**/*.{js,jsx,ts,tsx}", "src/**/*.{js,jsx,ts,tsx}"];

// Arbitrary values bypass the design tokens in src/styles/globals.css.
const designTokenRestrictions = [
	{
		pattern: "(^|:)(text|tracking|leading|font)-\\[",
		message: "Use a typography token from the theme, not an arbitrary value.",
	},
	{
		pattern: "(^|:)rounded(-[trblse]{1,2})?-\\[",
		message: "Use a radius token from the theme, not an arbitrary value.",
	},
	{
		pattern: "(^|:)(shadow|inset-shadow|drop-shadow)-\\[",
		message: "Use a shadow token from the theme, not an arbitrary value.",
	},
	{
		pattern: "\\[[^\\]]*(#[0-9a-fA-F]{3,8}\\b|rgba?\\(|hsla?\\(|oklch\\()",
		message: "Use a color token (var(--color-*)), not a raw color value.",
	},
];

const tailwindConfig = [
	{
		files,
		plugins: { "better-tailwindcss": betterTailwindcss },
		settings: {
			"better-tailwindcss": {
				entryPoint: "src/styles/globals.css",
				selectors: [
					...getDefaultSelectors(),
					{
						kind: "variable",
						match: [{ type: "strings" }, { type: "objectValues" }],
						name: "^.*(Class|Classes)$",
					},
				],
			},
		},
		rules: {
			"better-tailwindcss/enforce-consistent-class-order": "error",
			"better-tailwindcss/no-concatenated-classes": "error",
			"better-tailwindcss/no-conflicting-classes": "error",
			"better-tailwindcss/no-deprecated-classes": "error",
			"better-tailwindcss/no-duplicate-classes": "error",
			"better-tailwindcss/no-unknown-classes": "error",
			"better-tailwindcss/no-unnecessary-whitespace": "error",
			"better-tailwindcss/no-restricted-classes": [
				"error",
				{ restrict: designTokenRestrictions },
			],
		},
	},
];

export default tailwindConfig;
