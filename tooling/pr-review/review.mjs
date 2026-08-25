// Evaluation harness for the production agent boundary. Every fixture provides
// a multi-file base/head repository snapshot, and every dynamically discovered
// rule owner reviews it through the same Pi agent harness used by ci-review.mjs.
//
//   OPENAI_API_KEY=... OPENAI_REASONING=high node review.mjs [dev|holdout|blind]
//   OPENAI_API_KEY=... node review.mjs models
import { verifyBlindCorpus } from "./blind-integrity.mjs";
import { runRuleReviewer } from "./agent.mjs";
import {
	DEFAULT_BASE_URL,
	DEFAULT_MODEL,
	DEFAULT_REASONING,
	DEFAULT_SERVICE_TIER,
	loadSystems,
	makeRuntime,
	pool,
} from "./core.mjs";
import { createFixtureRepository } from "./fixture-repository.mjs";

const KEY = process.env.OPENAI_API_KEY;
const BASE = process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL;
const MODEL = process.env.OPENAI_MODEL || DEFAULT_MODEL;
const SERVICE_TIER = process.env.OPENAI_SERVICE_TIER || DEFAULT_SERVICE_TIER;
const REASONING = process.env.OPENAI_REASONING || DEFAULT_REASONING;
const TEMPERATURE =
	process.env.TEMPERATURE === undefined
		? undefined
		: Number(process.env.TEMPERATURE);
const CONC = Number(process.env.CONC ?? 8);
const RUNS = Number(process.env.RUNS ?? 1);
if (!Number.isInteger(CONC) || CONC < 1)
	throw new Error("CONC must be a positive integer");
if (!Number.isInteger(RUNS) || RUNS < 1)
	throw new Error("RUNS must be a positive integer");
const CASE_IDS = new Set(
	String(process.env.CASE_IDS ?? "")
		.split(",")
		.map((id) => id.trim())
		.filter(Boolean),
);
const PAIR_IDS = new Set(
	String(process.env.PAIR_IDS ?? "")
		.split(",")
		.map((id) => id.trim())
		.filter(Boolean),
);

const expectedAgents = (testCase) => new Set(testCase.violations ?? []);

if (!KEY) {
	console.error("OPENAI_API_KEY is not set.");
	process.exit(1);
}

const runtime = makeRuntime({
	key: KEY,
	base: BASE,
	model: MODEL,
	temperature: TEMPERATURE,
	serviceTier: SERVICE_TIER,
	reasoning: REASONING,
});

if (process.argv[2] === "models") {
	console.log(
		JSON.stringify(await runtime.api("/models", { method: "GET" }), null, 2),
	);
	process.exit(0);
}

const requestedSet = process.argv[2];
const which = ["dev", "holdout", "blind"].includes(requestedSet)
	? requestedSet
	: "dev";
const modules = {
	dev: "./cases.mjs",
	holdout: "./cases.holdout.mjs",
	blind: "./cases.blind.mjs",
};
if (which === "blind") await verifyBlindCorpus();
if (which === "blind" && (CASE_IDS.size > 0 || PAIR_IDS.size > 0))
	throw new Error("blind evaluation must run the complete frozen corpus");
const { cases: allCases } = await import(modules[which]);
const cases = CASE_IDS.size
	? allCases.filter((testCase) => CASE_IDS.has(testCase.id))
	: allCases;
if (CASE_IDS.size && cases.length !== CASE_IDS.size)
	throw new Error("CASE_IDS names an unknown or duplicate fixture");

async function reviewFixture(agent, system, testCase) {
	return runRuleReviewer({
		agent,
		system,
		repository: createFixtureRepository(testCase),
		runtime,
	});
}

const { agents, systems } = await loadSystems();

const allPairs = cases.flatMap((testCase) =>
	agents.map((agent) => ({ testCase, agent })),
);
const pairs = PAIR_IDS.size
	? allPairs.filter(({ testCase, agent }) =>
			PAIR_IDS.has(`${testCase.id}:${agent.id}`),
		)
	: allPairs;
if (PAIR_IDS.size && pairs.length !== PAIR_IDS.size)
	throw new Error("PAIR_IDS names an unknown or duplicate case:owner pair");
console.log(
	`set=${which} model=${MODEL} reasoning=${REASONING} temp=${TEMPERATURE} runs=${RUNS} architecture=whole-pr-agent agents=[${agents.map((agent) => agent.id).join(", ")}] cases=${cases.length} pairs=${pairs.length}\n`,
);
const pct = (value) => (value * 100).toFixed(1);
const prf = (tp, fp, fn) => {
	const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
	const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
	return {
		precision,
		recall,
		f1:
			precision + recall === 0
				? 0
				: (2 * precision * recall) / (precision + recall),
	};
};

let sumTP = 0;
let sumFP = 0;
let sumFN = 0;
const perAgent = Object.fromEntries(
	agents.map((agent) => [agent.id, { tp: 0, fp: 0, fn: 0 }]),
);
const fpCount = new Map();
const fnCount = new Map();

for (let run = 0; run < RUNS; run++) {
	const reviewed = await pool(pairs, CONC, ({ testCase, agent }) =>
		reviewFixture(agent, systems.get(agent.id), testCase),
	);
	const incomplete = reviewed
		.map((result, index) => ({ result, pair: pairs[index] }))
		.filter(({ result }) => result.status !== "complete");
	if (incomplete.length) {
		for (const { result, pair } of incomplete)
			console.error(
				`incomplete ${pair.testCase.id}:${pair.agent.id}: ${result.reason}`,
			);
		throw new Error(
			`evaluation aborted: ${incomplete.length} reviewer session(s) incomplete`,
		);
	}
	const predicted = reviewed.map((result) => result.findings.length > 0);
	let TP = 0;
	let FP = 0;
	let FN = 0;
	pairs.forEach(({ testCase, agent }, index) => {
		const expected = expectedAgents(testCase).has(agent.id);
		if (predicted[index] && expected) {
			TP++;
			perAgent[agent.id].tp++;
		} else if (predicted[index] && !expected) {
			FP++;
			perAgent[agent.id].fp++;
			const key = `${testCase.id}:${agent.id}`;
			fpCount.set(key, (fpCount.get(key) ?? 0) + 1);
		} else if (!predicted[index] && expected) {
			FN++;
			perAgent[agent.id].fn++;
			const key = `${testCase.id}:${agent.id}`;
			fnCount.set(key, (fnCount.get(key) ?? 0) + 1);
		}
	});
	sumTP += TP;
	sumFP += FP;
	sumFN += FN;
	const { precision, recall, f1 } = prf(TP, FP, FN);
	console.log(
		`run ${run + 1}: TP=${TP} FP=${FP} FN=${FN}  P=${pct(precision)}%  R=${pct(recall)}%  F1=${pct(f1)}%`,
	);
}

const mean = prf(sumTP, sumFP, sumFN);
console.log(
	`\nmicro-avg over ${RUNS} run(s): P=${pct(mean.precision)}%  R=${pct(mean.recall)}%  F1=${pct(mean.f1)}%`,
);
console.log("\nper-agent:");
for (const [id, scores] of Object.entries(perAgent)) {
	const metrics = prf(scores.tp, scores.fp, scores.fn);
	console.log(
		`  ${id.padEnd(26)} TP=${scores.tp} FP=${scores.fp} FN=${scores.fn} P=${pct(metrics.precision)}% R=${pct(metrics.recall)}% F1=${pct(metrics.f1)}%`,
	);
}

if (fpCount.size) {
	console.log("\nfalse positives (case:agent → runs/total):");
	for (const [key, count] of [...fpCount.entries()].sort((a, b) => b[1] - a[1]))
		console.log(`  ${key}  ${count}/${RUNS}`);
}
if (fnCount.size) {
	console.log("\nmissed (case:agent → runs/total):");
	for (const [key, count] of [...fnCount.entries()].sort((a, b) => b[1] - a[1]))
		console.log(`  ${key}  ${count}/${RUNS}`);
}
