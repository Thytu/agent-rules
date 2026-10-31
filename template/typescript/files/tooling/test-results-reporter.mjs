import path from "node:path";

// Writes one "outcome<TAB>file > test name" line per test, the format
// scripts/test-stability.sh compares across runs.
export default async function* report(source) {
	for await (const { type, data } of source) {
		if (type !== "test:pass" && type !== "test:fail") continue;
		// A failed suite repeats its failed children; count each test once.
		if (
			data.details?.type === "suite" ||
			data.details?.error?.failureType === "subtestsFailed"
		)
			continue;
		const outcome = data.skip
			? "skipped"
			: data.todo
				? "todo"
				: type === "test:pass"
					? "passed"
					: "failed";
		const file = path.relative(process.cwd(), data.file ?? "");
		yield `${outcome}\t${file} > ${data.name}\n`;
	}
}
