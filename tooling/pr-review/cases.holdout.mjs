import { defineFixtures } from "./fixture-repository.mjs";
import { OPENROSTRUM_FILES } from "./openrostrum-snapshot.mjs";

// HELD-OUT test set — the real generalization metric. It is NEVER used to tune
// the doctrine: the prompt must not be edited in reaction to any failure here.
//
// Two kinds:
//  - source:"real" exposes a complete OpenRostrum source file plus the full
//    tracked text repository: definitions, reverse callers, tests, documents,
//    package manifest, lockfile, workflows, and configuration. Most are clean:
//    legitimate WHY comments, regression tests, and sanctioned throws.
//  - source:"authored" adds a complete changed module to the shared multi-file
//    fixture application. Its positives use surfaces unlike the development set.
//
// Borderline real changes are excluded so labels remain an oracle, not a coin flip.

const specs = [
	// ---------- real, clean: legit WHY comments (must stay silent) ----------
	{
		id: "real-root-fonts",
		source: "real",
		file: "app/root.tsx",
		code: `// Fonts are self-hosted (open-source product — no CDN); @font-face lives in
// app.css, preloads here cover the two faces on every first paint.
export const links = () => [
	{ rel: "preload", href: "/fonts/plex-sans-400.woff2", as: "font" },
];`,
		violations: [],
	},
	{
		id: "real-icon-set",
		source: "real",
		file: "app/ui/icon.tsx",
		code: `// One icon set, one stroke weight (1.7, round caps) — mixed icon libraries
// read as two different products. Filled glyphs (sort, dots) override per path.
export function Icon({ name, size = 16 }) {
	return svg(PATHS[name], size);
}`,
		violations: [],
	},
	{
		id: "real-tabs-weight",
		source: "real",
		file: "app/ui/tabs.tsx",
		code: `// Active state changes color and underline, never weight — a weight change
// shifts layout on every tab switch.
const active = "text-fg border-b-2 border-petrol";`,
		violations: [],
	},
	{
		id: "real-textlink-petrol",
		source: "real",
		file: "app/ui/text-link.tsx",
		code: `// The only place petrol touches prose. Table titles and data stay ink —
// a full column of colored links pollutes status scanning.
export function TextLink(props) {
	return anchor(props, "text-petrol");
}`,
		violations: [],
	},
	{
		id: "real-chip-sanctioned-style",
		source: "real",
		file: "app/ui/chip.tsx",
		code: `// User-picked colors (e.g. a track's configured color) render as a DOT next
// to muted text, never as a filled pill — arbitrary backgrounds can't
// guarantee label contrast. The inline style is sanctioned: the color is
// data, not a design decision.
export function Chip({ color, label }) {
	return dot(color, label);
}`,
		violations: [],
	},
	{
		id: "real-table-shadow",
		source: "real",
		file: "app/ui/table.tsx",
		code: `// Selection = wash + ONE 2px petrol rule on the leading edge only
// (a per-cell shadow leaks ticks at every column boundary).
const selected = "bg-row-selected shadow-[inset_2px_0_0_0_var(--color-petrol)]";`,
		violations: [],
	},
	{
		id: "real-status-badge-dark",
		source: "real",
		file: "app/ui/status-badge.tsx",
		code: `// Status colors follow web convention (green=positive, red=negative) and are
// deliberately NOT skin tokens: they survive a re-skin unchanged. They live
// outside light-dark(), so this is the one primitive that writes dark:
// variants (there is no theme toggle — the media query can't desync).
const tone = { accepted: "bg-green-100 dark:bg-green-950" };`,
		violations: [],
	},
	{
		id: "real-avatar-identity",
		source: "real",
		file: "app/ui/avatar.tsx",
		code: `// Deterministic identity colors: same name, same hue, both themes readable.
// light-dark() in the inline style keeps the pair theme-correct without dark:
// variants; the values are a fixed design-system set, not user data.
const hue = HUES[hash(name) % HUES.length];`,
		violations: [],
	},
	{
		id: "real-button-primitive",
		source: "real",
		file: "app/ui/button.tsx",
		code: `// Primitives never accept className/style: every visual decision stays in
// app/ui + tokens so a re-skin needs zero route diffs.
const BASE = "inline-flex h-[34px] items-center rounded-control";`,
		violations: [],
	},
	{
		id: "real-track-clock",
		source: "real",
		file: "app/lib/track.ts",
		code: `// Per-request phase timings, surfaced once as a Server-Timing header.
// Workers clocks only advance across I/O, so timed sections must await real
// I/O (DB, fetch) to show a duration — pure CPU reads as ~0 by design.
export function createTimings() {
	return new Timings();
}`,
		violations: [],
	},
	{
		id: "real-auth-pbkdf2",
		source: "real",
		file: "app/lib/auth.ts",
		code: `// The Workers runtime hard-caps PBKDF2 deriveBits at 100k iterations in
// production (local workerd doesn't enforce it — logins 500 only when
// deployed, verified live 2026-08-10). 100k is therefore the ceiling here.
const PBKDF2_ITERATIONS = 100_000;`,
		violations: [],
	},
	{
		id: "real-auth-writeamp",
		source: "real",
		file: "app/lib/auth.ts",
		code: `// Unknown id (e.g. a garbage/forged cookie) → no DB write, so random cookies
// can't cause write-amplification.
if (!session) return null;`,
		violations: [],
	},
	{
		id: "real-worker-env",
		source: "real",
		file: "app/worker-env.d.ts",
		code: `// Runtime SECRETS (added via wrangler secret put, not wrangler.json bindings,
// so they aren't in the generated worker-configuration.d.ts). Declared here so
// port adapters read them type-safely instead of casting env as {...}.
declare namespace Cloudflare {
	interface Env { RESEND_API_KEY?: string }
}`,
		violations: [],
	},
	// ---------- real, clean: sanctioned throw + real regression test ----------
	{
		id: "real-email-throw",
		source: "real",
		file: "app/ports/email.ts",
		code: `export function createResendEmailSender(env) {
	const from = env.EMAIL_FROM;
	if (!from) {
		throw new Error("EMAIL_FROM is not configured — set it to your verified Resend sender address.");
	}
	return new ResendSender(env, from);
}`,
		violations: [],
	},
	{
		id: "real-resend-test",
		source: "real",
		file: "test/email.resend.test.ts",
		code: `it("throws on a non-2xx provider response so the caller can log + stay generic", async () => {
	vi.stubGlobal("fetch", mockFetch(422, { message: "bad" }));
	await expect(
		createResendEmailSender(env).send({ to: "a@b.com", subject: "s", html: "h" }),
	).rejects.toThrow(/Resend send failed \\(422\\)/);
});`,
		violations: [],
	},
	{
		id: "real-inject-header",
		source: "real",
		file: "scripts/inject-wrangler-id.mjs",
		code: `// Inject deployer-specific values into a wrangler config from the environment,
// so the committed config holds only generic placeholders (open-source safe: a
// fork sets its own env and deploys — no account ids or domains in git).
const id = process.env.CF_D1_DATABASE_ID;`,
		violations: [],
	},
	// ---------- authored, clean trap: legit polymorphic input (not a migration) ----------
	{
		id: "trap-union-input",
		source: "authored",
		file: "app/lib/tracks.ts",
		code: `export function toTracks(input) {
	return Array.isArray(input) ? input : [input];
}`,
		violations: [],
	},

	// ---------- real violation: a BS comment actually merged ----------
	{
		id: "real-bs-capabilities",
		source: "real",
		file: "app/marketing/content.ts",
		code: `// The nine capabilities the product actually ships (SCOPE's six firm
// requirements + the three that set it apart). Copy stays concrete: what an
// organizer can do, not adjectives.
export const FEATURES = [
	{ icon: "inbox", title: "Custom call for speakers" },
];`,
		violations: ["comments"],
	},

	// ---------- authored held-out positives (surface-different; measure-only) ----------
	{
		// A legit dependency-injection test: it pins "build stamps createdAt from
		// the injected clock" — a real contract. Looks tautological but isn't; a
		// good reviewer stays silent. (Precision trap, not a weak test.)
		id: "trap-injected-clock",
		source: "authored",
		file: "test/stamp.test.ts",
		code: `it("stamps createdAt", () => {
	const clock = { now: () => 1000 };
	const row = build({ clock });
	expect(row.createdAt).toBe(1000);
});`,
		violations: [],
	},
	{
		id: "hp-weak-mock-called",
		source: "authored",
		file: "test/contacts.save.test.ts",
		code: `it("saves the contact", async () => {
	const insert = vi.fn().mockResolvedValue({ id: 1 });
	await saveContact({ insert }, { email: "x@y.com" });
	expect(insert).toHaveBeenCalled();
});`,
		violations: ["testing"],
	},
	{
		id: "hp-shortcut-return-free",
		source: "authored",
		file: "app/lib/pricing.ts",
		code: `export function pricePerSeat() {
	// pricing isn't built yet, return free for now
	return 0;
}`,
		violations: ["comments", "contract-evolution"],
	},
	{
		id: "hp-shortcut-default-on-catch",
		source: "authored",
		file: "app/lib/prefs.ts",
		code: `export async function loadPrefs(db, id) {
	try {
		return await db.prefs.get(id);
	} catch (e) {
		return {};
	}
}`,
		violations: ["boundaries", "lifecycle-capacity"],
	},
	{
		id: "hp-legacy-deprecated-fn",
		source: "authored",
		file: "app/lib/date.ts",
		code: `/** @deprecated prefer formatDate */
export function fmtDate(d) {
	return formatDate(d);
}`,
		violations: ["contract-evolution"],
	},

	// ---------- more real, clean (widen the precision base) ----------
	{
		id: "real-track-header",
		source: "real",
		file: "app/lib/track.ts",
		code: `// Structured runtime events — the queryable record of what the app did
// (docs/observability.md). One JSON line per event so Workers Logs and
// wrangler tail --format=json can filter on fields, not grep prose.
export function track(event, fields) {
	console.log(JSON.stringify({ event, ...fields }));
}`,
		violations: [],
	},
	{
		id: "real-skeleton",
		source: "real",
		file: "app/ui/skeleton.tsx",
		code: `// Loading holds the page's shape — skeletons, never spinners, for lists.
export function SkeletonRows({ n = 8 }) {
	return rows(n);
}`,
		violations: [],
	},
	{
		id: "real-empty-state",
		source: "real",
		file: "app/ui/empty-state.tsx",
		code: `// An empty state says WHY it's empty and what to do next — "No X found"
// with no action ends the user's journey.
export function EmptyState({ title, action }) {
	return panel(title, action);
}`,
		violations: [],
	},
	{
		id: "real-entry-bots",
		source: "real",
		file: "app/entry.server.tsx",
		code: `// Bots and SPA-mode renders must wait for all content before responding, so
// crawlers and static generation see the full document, not a shell.
const ready = isbot(request.headers.get("user-agent")) ? "onAllReady" : "onShellReady";`,
		violations: [],
	},

	// ---------- more authored held-out positives (varied surface; measure-only) ----------
	{
		id: "hp-bs-rename",
		source: "authored",
		file: "app/lib/total.ts",
		code: `// renamed from computeTotal in the Aug cleanup
export function total(items) {
	return items.reduce((s, i) => s + i.price, 0);
}`,
		violations: ["comments"],
	},
	{
		id: "hp-bs-obvious-loop",
		source: "authored",
		file: "app/lib/each.ts",
		code: `export function sendAll(list) {
	// loop over each recipient and send
	for (const r of list) send(r);
}`,
		violations: ["comments"],
	},
	{
		id: "hp-weak-assert-true",
		source: "authored",
		file: "test/health.test.ts",
		code: `it("boots", async () => {
	await boot();
	expect(true).toBe(true);
});`,
		violations: ["testing"],
	},
	{
		id: "hp-weak-length-of-mock",
		source: "authored",
		file: "test/list.test.ts",
		code: `it("lists two", async () => {
	const db = { all: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]) };
	const rows = await listAll(db);
	expect(rows.length).toBe(2);
});`,
		violations: ["testing"],
	},
	{
		id: "hp-shortcut-fixme-nplusone",
		source: "authored",
		file: "app/lib/enrich.ts",
		code: `// FIXME: N+1, batch this later
export async function enrich(db, ids) {
	const out = [];
	for (const id of ids) out.push(await db.get(id));
	return out;
}`,
		violations: ["comments", "contract-evolution", "efficiency"],
	},
	{
		id: "hp-shortcut-empty-list-catch",
		source: "authored",
		file: "app/lib/tags.ts",
		code: `export async function tagsFor(db, id) {
	try {
		return await db.tags.forSession(id);
	} catch {
		return [];
	}
}`,
		violations: ["boundaries", "lifecycle-capacity"],
	},
	{
		id: "hp-legacy-renamed-column",
		source: "authored",
		file: "app/lib/contact.ts",
		code: `export function emailOf(row) {
	return row.email ?? row.emailAddress;
}`,
		violations: ["boundaries", "contract-evolution"],
	},
	{
		id: "hp-legacy-compat-export",
		source: "authored",
		file: "app/lib/names.ts",
		code: `export function displayName(c) {
	return c.name;
}
// kept so older imports keep resolving
export const getName = displayName;`,
		violations: ["contract-evolution"],
	},
	{
		id: "hp-auth-unscoped-update",
		source: "authored",
		file: "app/lib/accounts.ts",
		code: `export async function renameAccount(db, input) {
	return db.update(accounts).set({ name: input.name }).where(eq(accounts.id, input.id));
}`,
		violations: ["authorization-persistence"],
	},
	{
		id: "trap-auth-context-scope",
		source: "authored",
		file: "app/lib/accounts.ts",
		code: `export async function renameAccount(db, user, input) {
	return db.update(accounts).set({ name: input.name }).where(and(eq(accounts.id, input.id), eq(accounts.tenantId, user.tenantId)));
}`,
		violations: [],
	},
	{
		id: "hp-lifecycle-no-timeout",
		source: "authored",
		file: "app/ports/provider.ts",
		code: `export async function fetchProvider(url: URL) {
	return fetch(url);
}`,
		violations: ["lifecycle-capacity"],
	},
	{
		id: "trap-lifecycle-deadline",
		source: "authored",
		file: "app/ports/provider.ts",
		code: `export async function fetchProvider(url: URL) {
	return fetch(url, { signal: AbortSignal.timeout(5000) });
}`,
		violations: [],
	},
	{
		id: "hp-efficiency-reparse",
		source: "authored",
		file: "app/lib/matcher.ts",
		code: `export function matchesAll(pattern, values) {
	return values.filter((value) => new RegExp(pattern).test(value));
}`,
		violations: ["efficiency"],
	},
	{
		id: "trap-efficiency-compile-once",
		source: "authored",
		file: "app/lib/matcher.ts",
		code: `export function matchesAll(pattern, values) {
	const matcher = new RegExp(pattern);
	return values.filter((value) => matcher.test(value));
}`,
		violations: [],
	},
	{
		id: "hp-dependency-without-lock",
		source: "authored",
		file: "Cargo.toml",
		code: `[dependencies]
serde = "1.0"`,
		violations: ["dependency-integrity"],
	},
	{
		id: "trap-manifest-metadata-only",
		source: "authored",
		file: "Cargo.toml",
		code: `[package]
name = "product"
publish = false`,
		violations: [],
	},
];

const REAL_ANCHORS = {
	"real-bs-capabilities": "// The nine jobs that make up the program side",
	"real-entry-bots": "// Ensure requests from bots and SPA Mode renders",
	"real-email-throw": "export function createResendEmailSender",
	"real-resend-test": 'it("throws on a non-2xx provider response',
	"real-worker-env": "// Runtime SECRETS",
};

function withoutReviewedSubject(spec, code) {
	const sourceLines = spec.code.split("\n");
	const first = sourceLines.find((line) => line.trim())?.trim();
	const anchor = REAL_ANCHORS[spec.id] ?? first;
	const lines = code.split("\n");
	const start = lines.findIndex((line) => line.trim().startsWith(anchor));
	if (start < 0)
		throw new Error(
			`${spec.id} subject is absent from its captured source file`,
		);

	let end = start;
	if (lines[start].trim().startsWith("//")) {
		while (end + 1 < lines.length && lines[end + 1].trim().startsWith("//"))
			end++;
	} else {
		let braces = 0;
		let opened = false;
		for (; end < lines.length; end++) {
			for (const character of lines[end]) {
				if (character === "{") {
					braces++;
					opened = true;
				} else if (character === "}") braces--;
			}
			if (opened && braces === 0) break;
		}
	}
	return [...lines.slice(0, start), ...lines.slice(end + 1)].join("\n");
}

export const cases = defineFixtures(
	specs.map((spec) => {
		if (spec.source !== "real") return spec;
		const code = OPENROSTRUM_FILES[spec.file];
		if (code === undefined)
			throw new Error(`${spec.id} has no captured OpenRostrum source file`);
		const contextFiles = { ...OPENROSTRUM_FILES };
		delete contextFiles[spec.file];
		return {
			...spec,
			code,
			baseCode: withoutReviewedSubject(spec, code),
			contextFiles,
		};
	}),
);
