import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import { cases } from "./cases.blind.mjs";

const digestUrl = new URL("./cases.blind.sha256", import.meta.url);

export async function verifyBlindCorpus() {
	const expected = await fs.readFile(digestUrl, "utf8");
	const actual = createHash("sha256")
		.update(JSON.stringify(cases))
		.digest("hex");
	if (actual !== expected.trim()) {
		throw new Error(
			"the materialized blind repositories changed after they were frozen; retire them to calibration and replace the blind corpus before scoring",
		);
	}
	return actual;
}
