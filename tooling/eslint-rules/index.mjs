import { meaningfulTests } from "./meaningful-tests.mjs";
import { noCitationComments } from "./no-citation-comments.mjs";
import { noCompatShims } from "./no-compat-shims.mjs";
import { noDeferralComments } from "./no-deferral-comments.mjs";
import { noGenericInstanceof } from "./no-generic-instanceof.mjs";
import { noLongComments } from "./no-long-comments.mjs";
import { noLooseVariantObjects } from "./no-loose-variant-objects.mjs";
import { noRuntimeTypeof } from "./no-runtime-typeof.mjs";

export const housePlugin = {
	meta: { name: "house", version: "0.0.0" },
	rules: {
		"meaningful-tests": meaningfulTests,
		"no-citation-comments": noCitationComments,
		"no-compat-shims": noCompatShims,
		"no-deferral-comments": noDeferralComments,
		"no-generic-instanceof": noGenericInstanceof,
		"no-long-comments": noLongComments,
		"no-loose-variant-objects": noLooseVariantObjects,
		"no-runtime-typeof": noRuntimeTypeof,
	},
};
