import { defineFixtures } from "./fixture-repository.mjs";

// Labeled gold repositories for the reviewer. Every case contains a complete
// base/head repository snapshot; `violations` exhaustively names every rule
// owner whose document the changed code violates (empty = clean).

export const cases = defineFixtures([
	// ---- bs-comment: violations ----
	{
		id: "bs-restates-name",
		file: "app/lib/retry.ts",
		code: `// increment the retry counter
export function incrementRetryCounter(state) {
	state.retries += 1;
	return state;
}`,
		violations: ["comments"],
	},
	{
		id: "bs-change-narration",
		file: "app/config.ts",
		code: `// was P2, promoted to core in the Aug refactor
export const MAX_UPLOAD_MB = 25;`,
		violations: ["comments"],
	},
	{
		id: "bs-tier-citation",
		file: "app/lib/speakers.ts",
		code: `// implements product tier P1 #16 (public widgets), see eval-crosswalk EMB-04
export function loadSpeakers(db, eventId) {
	return db.select().from(contacts).where(eq(contacts.eventId, eventId));
}`,
		violations: ["comments", "authorization-persistence"],
	},
	{
		id: "bs-justification-prose",
		file: "app/marketing/mocks.tsx",
		code: `// Faithful, static renderings of the real product surfaces, built from the
// same tokens the live app uses, so the marketing page shows the actual thing
// and not a stylized impression.
export function SubmissionsMock() {
	return <section className="rounded-card border border-hair bg-surface"><h2>Submissions</h2><p>No submissions yet.</p></section>;
}`,
		violations: [],
	},

	// ---- bs-comment: clean traps ----
	{
		id: "ok-constraint-why",
		file: "app/lib/auth.ts",
		code: `// Cloudflare Workers hard-caps PBKDF2 at 100k iterations; a higher value
// throws only in production (workerd does not enforce it locally).
export const PBKDF2_ITERATIONS = 100_000;`,
		violations: [],
	},
	{
		id: "ok-platform-why",
		file: "app/db/write.ts",
		code: `export interface AtomicDatabase {
	batch(writes: readonly unknown[]): Promise<void>;
}

// D1 has no interactive transactions, so batch() is the only atomic multi-write.
export async function writeUserProfile(db: AtomicDatabase, insertUser: unknown, insertProfile: unknown) {
	await db.batch([insertUser, insertProfile]);
}`,
		violations: [],
	},
	{
		id: "ok-security-why",
		file: "app/routes/admin.submissions.tsx",
		code: `import { getActiveEvent } from "../lib/events";
import type { AuthenticatedUser, RuntimeEnv } from "../runtime";

// Server-derive the tenant; never trust a client-supplied eventId.
export async function activeEventId(env: RuntimeEnv, user: AuthenticatedUser) {
	return (await getActiveEvent(env, user)).id;
}`,
		contextFiles: {
			"app/lib/events.ts": `import type { AuthenticatedUser, RuntimeEnv } from "../runtime";

export async function getActiveEvent(_env: RuntimeEnv, user: AuthenticatedUser) {
	return { id: "active-" + user.tenantId };
}`,
		},
		violations: [],
	},
	{
		id: "ok-no-comment",
		file: "app/lib/name.ts",
		code: `export function fullName(contact) {
	return [contact.firstName, contact.lastName].filter(Boolean).join(" ");
}`,
		violations: [],
	},

	// ---- weak-test: violations ----
	{
		id: "weak-mock-theater",
		file: "test/notify.test.ts",
		code: `it("sends the email", async () => {
	const send = vi.fn();
	await notify({ send }, { to: "a@b.com" });
	expect(send).toHaveBeenCalledWith({ to: "a@b.com" });
});`,
		violations: ["testing"],
	},
	{
		id: "weak-rederived-oracle",
		file: "test/total.test.ts",
		code: `it("computes the total", () => {
	const items = [{ price: 3 }, { price: 4 }];
	const expected = items.reduce((s, i) => s + i.price, 0);
	expect(sumPrices(items)).toBe(expected);
});`,
		violations: ["testing"],
	},
	{
		id: "weak-copy-literal",
		file: "test/copy.test.ts",
		code: `import { WELCOME_COPY } from "../app/copy";
it("has welcome copy", () => {
	expect(WELCOME_COPY).toContain("Welcome to the call for speakers");
});`,
		contextFiles: {
			"app/copy.ts": `export const WELCOME_COPY = "Welcome to the call for speakers";
`,
		},
		violations: ["testing"],
	},
	{
		id: "weak-snapshot",
		file: "test/panel.test.ts",
		code: `it("renders the panel", () => {
	expect(render(Panel()).container.innerHTML).toMatchSnapshot();
});`,
		violations: ["testing"],
	},

	// ---- weak-test: clean traps ----
	{
		id: "ok-real-regression-test",
		file: "test/contacts.test.ts",
		code: `import { addContact, contacts, db, eq, eventId } from "../app/contacts";

it("rejects a duplicate email in the same event", async () => {
	await addContact(db, { eventId, email: "a@b.com" });
	await expect(addContact(db, { eventId, email: "a@b.com" })).rejects.toThrow();
	const rows = await db.select().from(contacts).where(eq(contacts.eventId, eventId));
	expect(rows).toHaveLength(1);
});`,
		contextFiles: {
			"app/contacts.ts": `export const eventId = "event-1";
export const contacts = { eventId: "eventId" } as const;
const rows: Array<{ eventId: string; email: string }> = [];
export const db = {
	select: () => ({ from: () => ({ where: async () => [...rows] }) }),
};
export const eq = (left: string, right: string) => ({ left, right });
export async function addContact(_db: typeof db, contact: { eventId: string; email: string }) {
	if (rows.some((row) => row.eventId === contact.eventId && row.email === contact.email)) {
		throw new Error("unique contact");
	}
	rows.push(contact);
}`,
		},
		violations: [],
	},
	{
		id: "ok-load-bearing-negative",
		file: "test/authz.integration.test.ts",
		code: `import { app, db, reqAs, reviewer, submissions } from "../app/authz";

it("403s a non-admin and never writes", async () => {
	const res = await app.fetch(reqAs(reviewer));
	expect(res.status).toBe(403);
	const rows = await db.select().from(submissions);
	expect(rows).toHaveLength(0);
});`,
		contextFiles: {
			"app/authz.ts": `export const reviewer = { role: "reviewer" } as const;
export const submissions = {};
const rows: unknown[] = [];
export const db = { select: () => ({ from: async () => [...rows] }) };
export const reqAs = (user: typeof reviewer) => new Request("https://fixture.test/admin", {
	headers: { "x-role": user.role },
});
export const app = {
	async fetch(request: Request) {
		if (request.headers.get("x-role") !== "admin") return new Response(null, { status: 403 });
		rows.push({});
		return new Response(null, { status: 204 });
	},
};`,
		},
		violations: [],
	},

	// ---- shortcut: violations ----
	{
		id: "shortcut-todo-unbounded",
		file: "app/lib/submissions.ts",
		code: `// TODO: paginate this once we have real data
export async function allSubmissions(db) {
	return db.select().from(submissions);
}`,
		violations: ["authorization-persistence", "comments", "contract-evolution"],
	},
	{
		id: "shortcut-hardcoded-id",
		file: "app/lib/event.ts",
		code: `export async function currentEvent(db) {
	// for now just grab the seeded event
	return db.query.events.findFirst({ where: eq(events.id, "evt_demo_123") });
}`,
		violations: ["authorization-persistence", "comments", "contract-evolution"],
	},
	{
		id: "shortcut-swallowed-error",
		file: "app/ports/airtable.ts",
		code: `export async function syncAirtable(env, record) {
	try {
		await pushToAirtable(env, record);
	} catch {
		// ignore
	}
}`,
		violations: ["boundaries", "comments", "lifecycle-capacity"],
	},
	{
		id: "shortcut-noop-validation",
		file: "app/lib/validate.ts",
		code: `export function validate(input) {
	// v0, skip validation for now, revisit later
	return true;
}`,
		violations: ["boundaries", "comments", "contract-evolution"],
	},

	// ---- shortcut: clean traps ----
	{
		id: "ok-sanctioned-throw",
		file: "app/ports/airtable.ts",
		code: `import type { RuntimeEnv } from "../runtime";
import { AirtableSync } from "./airtable-client";

export function createAirtableSync(env: RuntimeEnv) {
	if (!env.AIRTABLE_API_KEY) {
		throw new Error("AIRTABLE_API_KEY is not configured; set it to enable sync.");
	}
	return new AirtableSync(env.AIRTABLE_API_KEY);
}`,
		contextFiles: {
			"app/ports/airtable-client.ts": `export class AirtableSync {
	constructor(readonly apiKey: string) {}
}`,
		},
		violations: [],
	},
	{
		id: "ok-bounded-logged",
		file: "app/lib/recent.ts",
		code: `import { submissions } from "../db/schema";
import { eq } from "../db/query";
import type { RequestContext } from "../runtime";

export async function recentSubmissions(db, context: RequestContext) {
	const rows = await db.select().from(submissions)
		.where(eq(submissions.tenantId, context.user.tenantId)).limit(51);
	return { rows: rows.slice(0, 50), truncated: rows.length > 50 };
}`,
		contextFiles: {
			"app/auth.ts": `import type { RequestContext } from "./runtime";
export interface SessionVerifier { verify(request: Request): Promise<RequestContext["user"] | null> }
export async function authenticate(request: Request, verifier: SessionVerifier): Promise<RequestContext> {
	const user = await verifier.verify(request);
	if (!user) throw new Error("authentication required");
	return { user };
}`,
			"app/routes/recent.ts": `import { authenticate, type SessionVerifier } from "../auth";
import { recentSubmissions } from "../lib/recent";
export async function loader(request, db, verifier: SessionVerifier) {
	return recentSubmissions(db, await authenticate(request, verifier));
}`,
		},
		violations: [],
	},

	// ---- legacy-shim: violations ----
	{
		id: "legacy-deprecated-alias",
		file: "app/ports/email.ts",
		code: `export { EmailSender } from "./sender";
/** @deprecated use EmailSender */
export { EmailSender as Mailer } from "./sender";`,
		violations: ["contract-evolution"],
	},
	{
		id: "legacy-dual-format-reader",
		file: "app/lib/status.ts",
		code: `export function readStatus(row) {
	return typeof row.status === "string"
		? row.status
		: (row.status?.value ?? "pending");
}`,
		contextFiles: {
			"docs/contracts/submission-status.md": `# Submission status

Owner-approved current contract: status is a string. The former provider object
shape is retired; application readers must not accept both representations.
`,
		},
		violations: ["boundaries", "contract-evolution"],
	},
	{
		id: "legacy-parallel-v2",
		file: "app/lib/serialize.ts",
		code: `export function serializeSession(s) { return { id: s.id, title: s.title }; }
export function serializeSessionV2(s) { return { id: s.id, title: s.title, track: s.track }; }`,
		violations: ["boundaries", "contract-evolution"],
	},

	// ---- legacy-shim: clean traps (sanctioned compat boundaries) ----
	{
		id: "ok-api-v1-boundary",
		file: "app/routes/api.v1.sessions.ts",
		code: `// The external /api/v1 envelope remains Sessionboard-compatible:
// default page size 25, max 100. See docs/contracts/sessionboard-v1.md.
export function apiEnvelope(rows, page) {
	return { data: rows.slice(0, 25), page, pageSize: 25 };
}`,
		contextFiles: {
			"docs/contracts/sessionboard-v1.md": `# Sessionboard API v1

Owner-approved external compatibility contract. Responses use a data envelope,
default page size 25, and maximum page size 100.
`,
		},
		violations: [],
	},
	{
		id: "ok-ics-stable-uid",
		file: "app/lib/ics.ts",
		code: `export interface CalendarEvent { uid?: string }
export interface Session { id: string }

// Stable UID per session so calendar clients update the event in place
// instead of creating a duplicate on reschedule.
export function assignStableUid(event: CalendarEvent, session: Session) {
	event.uid = "session-" + session.id + "@openrostrum.com";
}`,
		violations: [],
	},

	// ---- lifecycle and cost: violations ----
	{
		id: "lifecycle-detached-task",
		file: "app/jobs/import.ts",
		code: `export function startImport(provider, batch) {
	void provider.import(batch);
	return { status: "started" };
}`,
		violations: ["boundaries", "lifecycle-capacity"],
	},
	{
		id: "lifecycle-unbounded-history",
		file: "app/lib/transcript-stream.ts",
		code: `export class TranscriptStream {
	chunks = [];
	onChunk(chunk) { this.chunks.push(chunk); }
}`,
		violations: ["lifecycle-capacity"],
	},
	{
		id: "cost-reparse-in-loop",
		file: "app/lib/route-events.ts",
		code: `export function routeEvents(env, events) {
	for (const event of events) {
		const routes = JSON.parse(env.ROUTES);
		deliver(routes[event.type], event);
	}
}`,
		violations: ["boundaries", "efficiency"],
	},

	// ---- lifecycle and cost: clean traps ----
	{
		id: "ok-owned-background-task",
		file: "app/jobs/import.ts",
		code: `export function startImport(provider, batch) {
	const controller = new AbortController();
	const result = provider.import(batch, { signal: controller.signal });
	return { cancel: () => controller.abort(), result };
}`,
		violations: [],
	},
	{
		id: "ok-parse-once-before-loop",
		file: "app/lib/route-events.ts",
		code: `export function routeEvents(env, events) {
	const routes = Routes.parse(JSON.parse(env.ROUTES));
	for (const event of events) deliver(routes[event.type], event);
}`,
		violations: [],
	},

	// ---- mixed + clean ----
	{
		id: "mixed-bs-and-shortcut",
		file: "app/lib/user.ts",
		code: `// helper to get the user
export async function getUser(db, id) {
	// TODO: cache this later
	return db.query.users.findFirst({ where: eq(users.id, id) });
}`,
		violations: ["authorization-persistence", "comments", "contract-evolution"],
	},
	{
		id: "ok-documented-fallback",
		file: "app/ports/turnstile.ts",
		code: `import { callTurnstile } from "./turnstile-client";

// Local and demonstration deployments expose an explicit non-success skip when
// no secret is configured; production deployments execute live bot protection.
export function verifyTurnstile(env, token) {
	if (!env.TURNSTILE_SECRET) return { ok: false, skipped: true, reason: "not-configured" };
	return callTurnstile(env.TURNSTILE_SECRET, token, { signal: AbortSignal.timeout(5_000) });
}`,
		contextFiles: {
			"app/ports/turnstile-client.ts": `export async function callTurnstile(secret, token, options) {
	const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
		method: "POST",
		body: JSON.stringify({ secret, response: token }),
		signal: options.signal,
	});
	if (!response.ok) throw new Error("Turnstile verification failed");
	const payload = await response.json();
	if (!payload || typeof payload.success !== "boolean") throw new Error("Invalid Turnstile response");
	return { ok: payload.success };
}`,
		},
		violations: [],
	},
	{
		id: "auth-client-tenant",
		file: "app/lib/contacts.ts",
		code: `import { contacts } from "../db/schema";
import { eq } from "../db/query";

export async function listContacts(db, input) {
	return db.select().from(contacts).where(eq(contacts.eventId, input.eventId));
}`,
		violations: ["authorization-persistence"],
	},
	{
		id: "ok-auth-server-tenant",
		file: "app/lib/contacts.ts",
		code: `import { contacts } from "../db/schema";
import { eq } from "../db/query";
import type { RequestContext } from "../runtime";

export async function listContacts(db, context: RequestContext) {
	const rows = await db.select().from(contacts)
		.where(eq(contacts.tenantId, context.user.tenantId)).limit(51);
	return { rows: rows.slice(0, 50), truncated: rows.length > 50 };
}`,
		contextFiles: {
			"app/auth.ts": `import type { RequestContext } from "./runtime";
export interface SessionVerifier { verify(request: Request): Promise<RequestContext["user"] | null> }
export async function authenticate(request: Request, verifier: SessionVerifier): Promise<RequestContext> {
	const user = await verifier.verify(request);
	if (!user) throw new Error("authentication required");
	return { user };
}`,
			"app/routes/contacts.ts": `import { authenticate, type SessionVerifier } from "../auth";
import { listContacts } from "../lib/contacts";
export async function loader(request, db, verifier: SessionVerifier) {
	return listContacts(db, await authenticate(request, verifier));
}`,
		},
		violations: [],
	},
	{
		id: "dependency-manifest-only",
		file: "package.json",
		code: `{
	"name": "review-fixture",
	"private": true,
	"type": "module",
	"scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" },
	"dependencies": { "undici": "7.16.0" },
	"devDependencies": { "typescript": "5.9.2", "vitest": "3.2.4" }
}`,
		violations: ["dependency-integrity"],
	},
	{
		id: "ok-package-without-dependency-change",
		file: "package.json",
		code: `{
	"name": "review-fixture",
	"private": true,
	"type": "module",
	"scripts": { "start": "node app.js", "test": "vitest run", "typecheck": "tsc --noEmit" },
	"devDependencies": { "typescript": "5.9.2", "vitest": "3.2.4" }
}`,
		violations: [],
	},
]);
