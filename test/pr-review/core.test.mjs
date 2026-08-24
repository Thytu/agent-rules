import assert from "node:assert/strict";
import { test } from "node:test";
import {
	createFlexFallbackFetch,
	DEFAULT_MODEL,
	FINDING_LIMITS,
	makeRuntime,
	streamOptions,
	SUBMISSIONS_PER_RESPONSE,
} from "../../tooling/pr-review/core.mjs";

test("the runtime uses Pi's native GPT-5.6 Luna Responses contract", () => {
	const runtime = makeRuntime({
		key: "test-key",
		base: "https://api.openai.test/v1",
		model: DEFAULT_MODEL,
		temperature: 0,
	});

	assert.equal(runtime.model.id, "gpt-5.6-luna");
	assert.equal(runtime.model.provider, "openai");
	assert.equal(runtime.model.api, "openai-responses");
	assert.equal(runtime.model.reasoning, true);
	assert.equal(runtime.model.thinkingLevelMap?.off, "none");
	assert.equal(runtime.model.maxTokens, 128_000);
	assert.equal(runtime.serviceTier, "flex");
});

test("stream options request Flex processing and required tools", () => {
	const sent = streamOptions({
		key: "test-key",
		model: { maxTokens: 128_000 },
		serviceTier: "flex",
		options: { toolChoice: "required" },
	});

	assert.equal(sent.serviceTier, "flex");
	assert.equal(sent.toolChoice, "required");
});

test("runtime preserves Flex and tool requirements through Pi", async () => {
	let payload;
	const runtime = makeRuntime({
		key: "test-key",
		fetchFn: async (_input, init) => {
			payload = JSON.parse(init.body);
			return new Response(
				JSON.stringify({ error: { message: "stop after capture" } }),
				{ status: 400, headers: { "content-type": "application/json" } },
			);
		},
	});
	const stream = runtime.streamFn(
		runtime.model,
		{ systemPrompt: "review", messages: [], tools: [] },
		{ toolChoice: "required" },
	);
	await stream.result();

	assert.equal(payload.model, DEFAULT_MODEL);
	assert.equal(payload.service_tier, "flex");
	assert.equal(payload.tool_choice, "required");
});

test("Flex resource exhaustion retries once with standard processing", async () => {
	const tiers = [];
	const fetchWithFallback = createFlexFallbackFetch(async (_input, init) => {
		const { service_tier: tier } = JSON.parse(init.body);
		tiers.push(tier);
		if (tier === "flex")
			return new Response(
				JSON.stringify({
					error: {
						code: "resource_unavailable",
						message: "Resource unavailable for Flex processing",
					},
				}),
				{ status: 429, headers: { "content-type": "application/json" } },
			);
		return new Response("{}", { status: 200 });
	});

	const response = await fetchWithFallback(
		"https://api.openai.test/responses",
		{
			method: "POST",
			body: JSON.stringify({ model: DEFAULT_MODEL, service_tier: "flex" }),
		},
	);

	assert.equal(response.status, 200);
	assert.deepEqual(tiers, ["flex", "default"]);
});

test("ordinary rate limits do not switch a Flex request to standard", async () => {
	let calls = 0;
	const fetchWithFallback = createFlexFallbackFetch(async () => {
		calls++;
		return new Response(
			JSON.stringify({
				error: { code: "rate_limit_exceeded", message: "Too many requests" },
			}),
			{ status: 429, headers: { "content-type": "application/json" } },
		);
	});

	const response = await fetchWithFallback(
		"https://api.openai.test/responses",
		{
			method: "POST",
			body: JSON.stringify({ model: DEFAULT_MODEL, service_tier: "flex" }),
		},
	);

	assert.equal(response.status, 429);
	assert.equal(calls, 1);
});

// Asking for less than the model allows is asking reviewers to truncate for a
// reason we invented. The ceiling belongs to the catalog.
test("the ceiling asked for is the model's own, not a derived budget", () => {
	const sent = streamOptions({
		key: "test-key",
		temperature: 0,
		model: { maxTokens: 384_000 },
	});

	assert.equal(sent.maxTokens, 384_000);
});

test("a model that cannot reach the contract ceiling is asked for its own", () => {
	const sent = streamOptions({
		key: "test-key",
		temperature: 0,
		model: { maxTokens: 2048 },
	});

	assert.equal(sent.maxTokens, 2048);
});

// The ceiling has to keep holding a worst-case response — a full allowance of
// maximum-size findings — or the contract truncates against its own limits.
test("the requested ceiling holds a full response of maximum-size findings", () => {
	const maximal = JSON.stringify(
		Array.from({ length: SUBMISSIONS_PER_RESPONSE }, () => ({
			file: `${"deep-directory/".repeat(8)}${"n".repeat(60)}.tsx`,
			line: 999_999,
			quote: "q".repeat(FINDING_LIMITS.quote),
			rule: "r".repeat(FINDING_LIMITS.rule),
			why: "w".repeat(FINDING_LIMITS.why),
		})),
	);
	const runtime = makeRuntime({
		key: "test-key",
		base: "https://api.openai.test/v1",
		model: DEFAULT_MODEL,
		temperature: 0,
	});
	const ceiling = streamOptions({
		key: "test-key",
		temperature: 0,
		model: runtime.model,
	}).maxTokens;

	assert.ok(
		ceiling > maximal.length / 4,
		`ceiling ${ceiling} cannot hold ${SUBMISSIONS_PER_RESPONSE} maximum findings (${maximal.length} chars)`,
	);
});
