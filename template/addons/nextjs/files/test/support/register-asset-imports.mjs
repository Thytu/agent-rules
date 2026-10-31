import { register } from "node:module";

// Components import stylesheets and images that only the Next.js bundler can
// load; tests replace them with stubs so the component code itself runs.
register("./asset-imports.mjs", import.meta.url);
