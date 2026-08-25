import { defineFixtures } from "./fixture-repository.mjs";

// Blind validation corpus. Freeze before its first model run. If it is ever used
// to tune prompts, rules, fixtures, or labels, retire it to the tuning corpus and
// replace it before claiming a generalization score.

export const cases = defineFixtures([
	{
		id: "blind-auth-client-tenant-list",
		file: "app/projects.ts",
		code: `export interface Project { id: string; tenantId: string }
export interface ProjectStore { listForTenant(tenantId: string): Promise<Project[]> }
export interface ListProjectsInput { tenantId: string }

export async function listProjects(store: ProjectStore, input: ListProjectsInput) {
	return store.listForTenant(input.tenantId);
}`,
		violations: ["authorization-persistence"],
	},
	{
		id: "blind-auth-client-account-write",
		file: "app/accounts.ts",
		code: `export interface AccountStore { rename(accountId: string, name: string): Promise<void> }
export interface RenameInput { accountId: string; name: string }

export async function renameAccount(store: AccountStore, input: RenameInput) {
	await store.rename(input.accountId, input.name);
}`,
		violations: ["authorization-persistence"],
	},
	{
		id: "blind-boundary-trusted-provider-cast",
		file: "app/provider.ts",
		code: `export interface Account { id: string; name: string }

export function accountFromProvider(payload: unknown): Account {
	return payload as Account;
}`,
		violations: ["boundaries"],
	},
	{
		id: "blind-boundary-default-on-parse-error",
		file: "app/status.ts",
		code: `export interface Status { state: "ready" | "blocked" }

export function parseStatus(raw: string): Status {
	try {
		return JSON.parse(raw) as Status;
	} catch {
		return { state: "ready" };
	}
}`,
		violations: ["boundaries"],
	},
	{
		id: "blind-comment-restates-operation",
		file: "app/counter.ts",
		code: `// Add one to the counter.
export function increment(value: number) {
	return value + 1;
}`,
		violations: ["comments"],
	},
	{
		id: "blind-comment-planning-citation",
		file: "app/export.ts",
		code: `// Implements roadmap item DATA-42 from the Q4 planning review.
export const EXPORT_BATCH_SIZE = 100;
`,
		violations: ["comments"],
	},
	{
		id: "blind-contract-deprecated-alias",
		file: "app/names.ts",
		code: `export function displayName(first: string, last: string) {
	return [first, last].filter(Boolean).join(" ");
}

/** @deprecated use displayName */
export const fullName = displayName;
`,
		violations: ["contract-evolution"],
	},
	{
		id: "blind-contract-parallel-v2",
		file: "app/session.ts",
		code: `export interface Session { id: string; title: string; track: string }

export function serializeSession(session: Session) {
	return { id: session.id, title: session.title };
}

export function serializeSessionV2(session: Session) {
	return { id: session.id, title: session.title, track: session.track };
}`,
		violations: ["boundaries", "contract-evolution"],
	},
	{
		id: "blind-dependency-without-lock",
		file: "package.json",
		code: `{
	"name": "review-fixture",
	"private": true,
	"type": "module",
	"scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" },
	"dependencies": { "zod": "4.1.5" },
	"devDependencies": { "typescript": "5.9.2", "vitest": "3.2.4" }
}`,
		violations: ["dependency-integrity"],
	},
	{
		id: "blind-unpinned-workflow-runtime",
		file: ".github/workflows/check.yml",
		code: `name: Check
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: latest
      - run: npm test
`,
		violations: ["dependency-integrity"],
	},
	{
		id: "blind-efficiency-regexp-in-loop",
		file: "app/filter.ts",
		code: `export function matching(pattern: string, values: readonly string[]) {
	return values.filter((value) => new RegExp(pattern).test(value));
}`,
		violations: ["efficiency"],
	},
	{
		id: "blind-efficiency-config-parse-in-loop",
		file: "app/dispatch.ts",
		code: `export interface Event { type: string }

export function dispatch(rawRoutes: string, events: readonly Event[]) {
	for (const event of events) {
		const routes = JSON.parse(rawRoutes) as Record<string, string>;
		deliver(routes[event.type], event);
	}
}

declare function deliver(route: string, event: Event): void;
`,
		contextFiles: {
			"app/worker.ts": `import { dispatch, type Event } from "./dispatch";
import type { RuntimeEnv } from "./runtime";

export function handleEvents(env: RuntimeEnv, events: readonly Event[]) {
	return dispatch(env.ROUTES, events);
}
`,
		},
		violations: ["boundaries", "efficiency"],
	},
	{
		id: "blind-lifecycle-detached-provider-job",
		file: "app/jobs.ts",
		code: `export interface Provider { run(): Promise<void> }

export function startJob(provider: Provider) {
	void provider.run();
	return { status: "started" as const };
}`,
		violations: ["boundaries", "lifecycle-capacity"],
	},
	{
		id: "blind-lifecycle-unbounded-retention",
		file: "app/history.ts",
		code: `export class EventHistory {
	private readonly events: string[] = [];

	record(event: string) {
		this.events.push(event);
	}

	all() {
		return [...this.events];
	}
}`,
		violations: ["lifecycle-capacity"],
	},
	{
		id: "blind-testing-mock-call-only",
		file: "test/email.test.ts",
		code: `import { expect, it, vi } from "vitest";
import { notify } from "../app/notify";

it("sends an email", async () => {
	const send = vi.fn().mockResolvedValue(undefined);
	await notify({ send }, "person@example.com");
	expect(send).toHaveBeenCalled();
});`,
		contextFiles: {
			"app/notify.ts": `export interface Mailer { send(to: string): Promise<void> }
export async function notify(mailer: Mailer, to: string) { await mailer.send(to); }
`,
		},
		violations: ["testing"],
	},
	{
		id: "blind-testing-rederived-oracle",
		file: "test/total.test.ts",
		code: `import { expect, it } from "vitest";
import { total } from "../app/total";

it("totals invoice lines", () => {
	const lines = [{ amount: 7 }, { amount: 11 }];
	const expected = lines.reduce((sum, line) => sum + line.amount, 0);
	expect(total(lines)).toBe(expected);
});`,
		contextFiles: {
			"app/total.ts": `export function total(lines: ReadonlyArray<{ amount: number }>) {
	return lines.reduce((sum, line) => sum + line.amount, 0);
}
`,
		},
		violations: ["testing"],
	},
	{
		id: "blind-clean-authenticated-bounded-list",
		file: "app/projects.ts",
		code: `import type { RequestContext } from "./runtime";

export interface Project { id: string; tenantId: string }
export interface ProjectStore { listForTenant(tenantId: string, limit: number): Promise<Project[]> }

export async function listProjects(store: ProjectStore, context: RequestContext) {
	const rows = await store.listForTenant(context.user.tenantId, 51);
	return { rows: rows.slice(0, 50), truncated: rows.length > 50 };
}`,
		contextFiles: {
			"app/runtime.ts": `export interface RequestContext { user: { id: string; tenantId: string } }
`,
			"app/auth.ts": `import type { RequestContext } from "./runtime";
export interface SessionVerifier { verify(request: Request): Promise<RequestContext["user"] | null> }
export async function authenticate(request: Request, verifier: SessionVerifier): Promise<RequestContext> {
	const user = await verifier.verify(request);
	if (!user) throw new Error("authentication required");
	return { user };
}
`,
			"app/routes/projects.ts": `import { authenticate, type SessionVerifier } from "../auth";
import { listProjects, type ProjectStore } from "../projects";
export async function loader(request: Request, store: ProjectStore, verifier: SessionVerifier) {
	const context = await authenticate(request, verifier);
	return listProjects(store, context);
}
`,
		},
		violations: [],
	},
	{
		id: "blind-clean-validated-provider-shape",
		file: "app/provider.ts",
		code: `export interface Account { id: string; name: string }

export function accountFromProvider(payload: unknown): Account {
	if (!payload || typeof payload !== "object" || !("id" in payload) || !("name" in payload)) {
		throw new Error("provider returned an invalid account");
	}
	if (typeof payload.id !== "string" || typeof payload.name !== "string") {
		throw new Error("provider returned an invalid account");
	}
	return { id: payload.id, name: payload.name };
}`,
		violations: [],
	},
	{
		id: "blind-clean-why-comment",
		file: "app/token.ts",
		code: `// Tokens use URL-safe base64 so they survive email-client link rewriting
// without percent-encoding differences invalidating signatures.
export function token(bytes: Uint8Array) {
	return Buffer.from(bytes).toString("base64url");
}`,
		violations: [],
	},
	{
		id: "blind-clean-owned-compatibility",
		file: "app/api-v1.ts",
		code: `// The external v1 envelope remains stable for partner integrations.
// See docs/contracts/api-v1.md for the owner-approved compatibility contract.
export function envelope(rows: readonly unknown[]) {
	return { data: rows.slice(0, 25), pageSize: 25 };
}`,
		contextFiles: {
			"docs/contracts/api-v1.md": `# API v1 compatibility

Owner-approved external contract: responses use a data envelope and at most 25 rows.
`,
		},
		violations: [],
	},
	{
		id: "blind-clean-manifest-metadata",
		file: "package.json",
		code: `{
	"name": "review-fixture",
	"description": "Reviewer fixture application",
	"private": true,
	"type": "module",
	"scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" },
	"devDependencies": { "typescript": "5.9.2", "vitest": "3.2.4" }
}`,
		violations: [],
	},
	{
		id: "blind-clean-regexp-once",
		file: "app/filter.ts",
		code: `export function matching(pattern: string, values: readonly string[]) {
	const matcher = new RegExp(pattern);
	return values.filter((value) => matcher.test(value));
}`,
		violations: [],
	},
	{
		id: "blind-clean-owned-job",
		file: "app/jobs.ts",
		code: `export interface Provider { run(options: { signal: AbortSignal }): Promise<void> }

export function startJob(provider: Provider) {
	const controller = new AbortController();
	const result = provider.run({ signal: controller.signal });
	return { result, cancel: () => controller.abort() };
}`,
		violations: [],
	},
	{
		id: "blind-clean-behavioral-test",
		file: "test/parse.test.ts",
		code: `import { expect, it } from "vitest";
import { parsePageSize } from "../app/page-size";

it("rejects a page size above the public maximum", () => {
	expect(() => parsePageSize(101)).toThrow();
});`,
		contextFiles: {
			"app/page-size.ts": `export function parsePageSize(value: number) {
	if (!Number.isInteger(value) || value < 1 || value > 100) throw new RangeError("invalid page size");
	return value;
}
`,
		},
		violations: [],
	},
]);
