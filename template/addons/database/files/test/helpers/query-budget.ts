import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import type { Logger } from "drizzle-orm/logger";

type QueryCounts = {
	total: number;
	statements: Map<string, number>;
};

// Pass an instance as Drizzle's `logger`, then wrap a read in `check` to fail
// the test when it issues more queries than its budget: the signature of N+1.
export class QueryBudget implements Logger {
	private readonly scopes = new AsyncLocalStorage<QueryCounts>();

	logQuery(query: string, _params: unknown[]): void {
		const counts = this.scopes.getStore();
		if (counts === undefined) return;
		// Keep only a fingerprint: bound values and literals can be user data.
		const fingerprint = createHash("sha256").update(query).digest("hex");
		counts.total += 1;
		counts.statements.set(
			fingerprint,
			(counts.statements.get(fingerprint) ?? 0) + 1,
		);
	}

	async check<T>(
		operation: string,
		limits: { maxQueries: number; maxPerStatement: number },
		action: () => Promise<T>,
	): Promise<T> {
		const counts: QueryCounts = { total: 0, statements: new Map() };
		const result = await this.scopes.run(counts, action);
		assert.ok(
			counts.total > 0,
			`${operation}: no queries captured; check the Drizzle logger wiring`,
		);
		assert.ok(
			counts.total <= limits.maxQueries,
			`${operation}: query budget exceeded (${counts.total} > ${limits.maxQueries}); possible N+1`,
		);
		for (const [fingerprint, count] of counts.statements) {
			assert.ok(
				count <= limits.maxPerStatement,
				`${operation}: possible N+1; statement ${fingerprint.slice(0, 12)} ran ${count} times (limit ${limits.maxPerStatement})`,
			);
		}
		return result;
	}
}
