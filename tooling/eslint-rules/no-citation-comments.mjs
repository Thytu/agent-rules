// Comments must state the load-bearing constraint itself; citations of
// planning docs rot the moment those docs change and read as reviewer-talk
// Mappings live in docs/eval-crosswalk.md, never in code. See
// docs/rules/comments.md.
const CITATION =
	/\bP[0-2]\s*#\d|eval[- ]kit|\b(CFP|ABS|SPK|CNT|AIA|EMB|CRM)-\d{2}\b/;

export const noCitationComments = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Code comments must not cite planning tiers or evaluation rubric IDs — state the constraint directly.",
		},
		schema: [],
		messages: {
			citation:
				"Comment cites a planning doc ({{match}}). Delete the citation and state the load-bearing WHY directly — or delete the comment if nothing remains. See docs/rules/comments.md.",
		},
	},
	create(context) {
		const sourceCode = context.sourceCode;
		return {
			Program() {
				for (const comment of sourceCode.getAllComments()) {
					const match = CITATION.exec(comment.value);
					if (match) {
						context.report({
							loc: comment.loc,
							messageId: "citation",
							data: { match: match[0] },
						});
					}
				}
			},
		};
	},
};
