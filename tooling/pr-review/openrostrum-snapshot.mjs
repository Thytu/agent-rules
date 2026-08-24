import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const snapshot = fileURLToPath(
	new URL("./openrostrum-snapshot.json.gz", import.meta.url),
);

// Full tracked text repository captured for held-out review fixtures. Binary
// assets are irrelevant to the source reviewer; every source, caller, test,
// document, manifest, lock, workflow, and configuration file is present.
export const OPENROSTRUM_FILES = JSON.parse(
	gunzipSync(readFileSync(snapshot)).toString("utf8"),
);
