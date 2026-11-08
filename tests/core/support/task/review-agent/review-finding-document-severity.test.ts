import { describe, expect, test } from "@jest/globals";
import { REVIEW_SEVERITY_REQUIREMENT } from "src/core/support/task/review-agent/constants";
import { ReviewFindingDocument } from "src/core/support/task/review-agent/review_finding_document";

describe("review finding document severity", () => {
	test.each(["High", "Major", "Medium"])("accepts the severity value %s", (severity) => {
		const text = [
			"# Finding",
			`Severity: ${severity}`,
			"Status: Open",
			"Task: Preserve the invariant.",
			"Affected paths:",
			"- `src/source.ts`",
			"Invariant: Keep source identity.",
			"Evidence:",
			"- The selected source is replaced.",
			"Reproduction: Resolve two same-named declarations.",
			"Impact: Usage is attributed incorrectly.",
			"Required correction:",
			"- Preserve the source identity.",
		].join("\n");
		const document = new ReviewFindingDocument(text);

		expect(document.missing_fields()).toEqual([]);
	});

	test.each(["", "Critical", "major", "Major (urgent)"])("rejects the severity value %s", (severity) => {
		const text = [
			"# Finding",
			`Severity: ${severity}`,
			"Status: Open",
			"Task: Preserve the invariant.",
			"Affected paths:",
			"- `src/source.ts`",
			"Invariant: Keep source identity.",
			"Evidence:",
			"- The selected source is replaced.",
			"Reproduction: Resolve two same-named declarations.",
			"Impact: Usage is attributed incorrectly.",
			"Required correction:",
			"- Preserve the source identity.",
		].join("\n");
		const document = new ReviewFindingDocument(text);

		expect(document.missing_fields()).toContain(REVIEW_SEVERITY_REQUIREMENT);
	});
});
