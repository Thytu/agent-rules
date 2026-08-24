// Shared reviewer core: the same rule-owner prompts and Pi runtime power both
// the labeled eval harness and production CI.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createModels } from "@earendil-works/pi-ai";
import { openaiProvider } from "@earendil-works/pi-ai/providers/openai";
import { loadAgents, REPO_ROOT } from "./agents.mjs";

export const DEFAULT_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_MODEL = "gpt-5.6-luna";
export const DEFAULT_SERVICE_TIER = "flex";
export const DEFAULT_REASONING = "high";
const STANDARD_SERVICE_TIER = "default";

// Per-field ceilings for one finding. The prompt states these numbers and the
// submit_finding boundary enforces them, so a reviewer is never told one contract
// and held to another. Only these five fields reach GitHub; everything else a
// reviewer writes is spent budget that buys no review.
export const FINDING_LIMITS = { quote: 240, rule: 100, why: 240 };

// How many findings one response may submit. Enforced in agent.mjs, so it is a
// property of this contract rather than a guess about the provider: past the
// cap, the extra submissions are refused with a reason and re-issued next turn.
export const SUBMISSIONS_PER_RESPONSE = 10;

// Use the catalog's own output ceiling. A smaller local guess can truncate a
// valid response containing the full per-response finding allowance.

export function requestCeiling(model) {
	return model?.maxTokens;
}

export const WRAPPER = `You are a strict senior code reviewer for this repository. Below is ONE of the repo's rule documents — it is your sole source of truth. Review the entire pull request for violations of rules stated IN THIS DOCUMENT ONLY. Other reviewers independently own the other rule documents; lint and CI own mechanical checks. Do not comment on style or taste.

Your review gates merges, so a false positive is expensive. Investigate repository context when needed, but only report a concrete violation introduced by the pull request that you can defend by quoting this rule document and exact changed code. Descriptive material and rules whose required context cannot be established are not findings. The absence of something is only a finding when this document explicitly requires it for this kind of change.

Choose your own investigation order and breadth. Use the read-only repository tools to inspect changed diffs, changed or unchanged files, definitions, callers, tests, and schema. The changed-file index is orientation, not source evidence. Finish only after you have reviewed the pull request as a whole under this document.

Report each violation with a submit_finding call the moment you are sure of it, and never hold findings back to list them at the end. Submissions are banked as you make them, so a review cut short still delivers everything it had already proved. Every turn you take is either tool calls or the final completion signal — never a plan, a status note, a running commentary, or a summary of what you just read. Never restate, paraphrase, or quote back this rule document: the reader already has it. Files you inspected and cleared are not part of the review; only violations are. Nothing you write outside submit_finding calls and the final signal is read by anyone. Investigate as widely as the pull request demands.`;

export function extractJson(text) {
	try {
		return JSON.parse(text);
	} catch {
		const start = text.indexOf("{");
		const end = text.lastIndexOf("}");
		if (start >= 0 && end > start) {
			try {
				return JSON.parse(text.slice(start, end + 1));
			} catch {
				return null;
			}
		}
		return null;
	}
}

export async function loadSystems() {
	const agents = loadAgents();
	const systems = new Map();
	for (const agent of agents) {
		const doc = await readFile(join(REPO_ROOT, agent.doc), "utf8");
		systems.set(
			agent.id,
			`${WRAPPER}\n\n=== RULE DOCUMENT: ${agent.doc} ===\n\n${doc}`,
		);
	}
	return { agents, systems };
}

const REQ_TIMEOUT_MS = Number(process.env.REQ_TIMEOUT_MS ?? 60000);

async function isFlexResourceUnavailable(response) {
	if (response.status !== 429) return false;
	try {
		const payload = await response.clone().json();
		const error = payload?.error ?? {};
		return (
			error.code === "resource_unavailable" ||
			/resource unavailable/i.test(String(error.message ?? ""))
		);
	} catch {
		return false;
	}
}

// OpenAI documents 429 resource_unavailable as Flex capacity exhaustion and
// recommends retrying the same request with standard processing. Other 429s
// remain rate-limit failures; authentication and validation failures never
// change tier.
export function createFlexFallbackFetch(fetchFn = globalThis.fetch) {
	return async (input, init) => {
		const response = await fetchFn(input, init);
		if (!(await isFlexResourceUnavailable(response))) return response;
		if (typeof init?.body !== "string") return response;

		try {
			const payload = JSON.parse(init.body);
			if (payload.service_tier !== "flex") return response;
			return fetchFn(input, {
				...init,
				body: JSON.stringify({
					...payload,
					service_tier: STANDARD_SERVICE_TIER,
				}),
			});
		} catch {
			return response;
		}
	};
}

// Pi forwards a max-output value only when maxTokens is set; with none, the
// provider's own default can truncate a reviewer mid-response.
export function streamOptions({
	key,
	temperature,
	model,
	serviceTier,
	fetchFn,
	options = {},
}) {
	return {
		...options,
		apiKey: key,
		temperature,
		maxTokens: options.maxTokens ?? requestCeiling(model),
		...(serviceTier ? { serviceTier: options.serviceTier ?? serviceTier } : {}),
		...(fetchFn ? { fetch: options.fetch ?? fetchFn } : {}),
		timeoutMs: REQ_TIMEOUT_MS,
		maxRetries: 3,
	};
}

export function makeRuntime({
	key,
	base = DEFAULT_BASE_URL,
	model = DEFAULT_MODEL,
	temperature,
	serviceTier = DEFAULT_SERVICE_TIER,
	reasoning = DEFAULT_REASONING,
	fetchFn = globalThis.fetch,
}) {
	if (
		!["off", "minimal", "low", "medium", "high", "xhigh", "max"].includes(
			reasoning,
		)
	)
		throw new Error(`Unsupported reasoning level: ${reasoning}`);
	if (!["flex", "auto", "default"].includes(serviceTier))
		throw new Error(`Unsupported OpenAI service tier: ${serviceTier}`);

	const models = createModels();
	models.setProvider(openaiProvider());
	const catalogModel = models.getModel("openai", model);
	const template = catalogModel ?? models.getModel("openai", DEFAULT_MODEL);
	if (!template) throw new Error(`OpenAI model is unavailable: ${model}`);
	const activeModel = {
		...template,
		id: model,
		name: catalogModel?.name ?? model,
		baseUrl: base,
	};
	const requestFetch =
		serviceTier === "flex" ? createFlexFallbackFetch(fetchFn) : fetchFn;

	async function api(path, init) {
		const response = await fetchFn(`${base}${path}`, {
			signal: AbortSignal.timeout(REQ_TIMEOUT_MS),
			...init,
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${key}`,
				...(init?.headers ?? {}),
			},
		});
		if (!response.ok)
			throw new Error(
				`${response.status} ${response.statusText}: ${await response.text()}`,
			);
		return response.json();
	}

	return {
		model: activeModel,
		serviceTier,
		reasoning,
		api,
		streamFn(selectedModel, context, options = {}) {
			const { reasoning: requestedReasoning = reasoning, ...providerOptions } =
				options;
			return models.stream(
				selectedModel,
				context,
				streamOptions({
					key,
					temperature,
					model: selectedModel ?? activeModel,
					serviceTier,
					fetchFn: requestFetch,
					options: {
						...providerOptions,
						reasoningEffort: requestedReasoning,
					},
				}),
			);
		},
	};
}

export async function pool(items, size, fn) {
	const results = new Array(items.length);
	let index = 0;
	await Promise.all(
		Array.from({ length: Math.min(size, items.length) }, async () => {
			while (index < items.length) {
				const current = index++;
				results[current] = await fn(items[current], current);
			}
		}),
	);
	return results;
}
