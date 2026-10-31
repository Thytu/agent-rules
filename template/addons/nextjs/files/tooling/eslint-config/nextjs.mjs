import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { reactFiles, reactRules } from "./react.mjs";

// Next.js registers the React plugins, so the React rules apply on top of its
// presets here instead of through the React config.
const nextjsConfig = [
	...nextVitals,
	...nextTypescript,
	{ files: reactFiles, rules: reactRules },
];

export default nextjsConfig;
