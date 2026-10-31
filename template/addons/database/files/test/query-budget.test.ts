import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryBudget } from "./helpers/query-budget.ts";

const limits = { maxQueries: 2, maxPerStatement: 1 };

test("a read within budget returns its result and ignores queries outside the check", async () => {
	const budget = new QueryBudget();
	budget.logQuery("insert into fixture values ($1)", ["setup"]);
	const result = await budget.check("list", limits, async () => {
		budget.logQuery("select * from parents", []);
		await Promise.resolve();
		budget.logQuery("select * from children where parent_id = any($1)", [
			[1, 2],
		]);
		return ["parent", "child"];
	});
	assert.deepEqual(result, ["parent", "child"]);
});

test("a statement repeated per row fails without exposing SQL or values", async () => {
	const budget = new QueryBudget();
	await assert.rejects(
		budget.check("children", { ...limits, maxQueries: 10 }, async () => {
			for (const id of ["private-one", "private-two", "private-three"]) {
				budget.logQuery("select 'private-literal' where parent_id = $1", [id]);
			}
		}),
		(error: Error) => {
			assert.match(
				error.message,
				/children: possible N\+1; statement \w+ ran 3 times/,
			);
			assert.doesNotMatch(error.message, /private|select|parent_id/);
			return true;
		},
	);
});

test("the total budget catches distinct statements and an unwired logger", async () => {
	const budget = new QueryBudget();
	await assert.rejects(
		budget.check("mixed", limits, async () => {
			budget.logQuery("select * from parents", []);
			budget.logQuery("select * from children", []);
			budget.logQuery("select * from users", []);
		}),
		/mixed: query budget exceeded \(3 > 2\)/,
	);
	await assert.rejects(
		budget.check("unwired", limits, async () => []),
		/unwired: no queries captured/,
	);
});

test("concurrent checks count separately and keep database failures intact", async () => {
	const budget = new QueryBudget();
	const results = await Promise.all(
		[1, 2, 3].map((id) =>
			budget.check(`request ${id}`, limits, async () => {
				budget.logQuery("select * from parents where id = $1", [id]);
				await Promise.resolve();
				budget.logQuery("select * from children where parent_id = $1", [id]);
				return id;
			}),
		),
	);
	assert.deepEqual(results, [1, 2, 3]);
	const failure = new Error("connection lost");
	await assert.rejects(
		budget.check("failed", limits, async () => {
			throw failure;
		}),
		(error) => error === failure,
	);
});
