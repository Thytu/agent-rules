// A "for now / TODO / temporary" comment silently turns a product decision
// into a permanent code path. Resolve the requirement explicitly; an approved
// unavailable path throws instead of degrading, and code carries no deferral
// marker (see docs/rules/contract-evolution.md).
const DEFERRAL =
	/\b(TODO|FIXME|XXX)\b|\bhack(y|ish)?\b|for now\b|\btemporar(y|ily)\b|\bstopgap\b|\bband-aid\b|quick (fix|follow)|good enough for\b|for the demo\b|in a real (app|product|implementation)\b|(implement|handle|clean(ed)? up|improve|finish|fix( it)?|do (this|it)|revisit)\s+(this\s+)?later\b|\bfollow-?up (PR|task|change)\b/i;

export const noDeferralComments = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Ban deferral and shortcut markers in comments — resolve product decisions explicitly instead of leaving promises in code.",
		},
		schema: [],
		messages: {
			deferral:
				'Deferral marker in a comment ("{{match}}"). Build it, change the requirement explicitly, or fail clearly when unavailable — then delete this marker. See docs/rules/contract-evolution.md.',
		},
	},
	create(context) {
		return {
			Program() {
				for (const comment of context.sourceCode.getAllComments()) {
					const match = DEFERRAL.exec(comment.value);
					if (match) {
						context.report({
							loc: comment.loc,
							messageId: "deferral",
							data: { match: match[0] },
						});
					}
				}
			},
		};
	},
};
