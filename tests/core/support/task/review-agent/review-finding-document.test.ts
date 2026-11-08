import { describe, expect, test } from "@jest/globals";
import { ReviewFindingDocument } from "src/core/support/task/review-agent/review_finding_document";

describe("review finding document format", () => {
	test("accepts a complete open finding", () => {
		const document = new ReviewFindingDocument(
			[
				"# Source ownership is lost",
				"Severity: Major",
				"Status: Open",
				"",
				"Task: Preserve the defining file when resolving the instance.",
				"",
				"Affected paths:",
				"- `src/source.ts`: `resolve_source`.",
				"",
				"Invariant: A resolved instance retains its declaring file.",
				"",
				"Evidence:",
				"- The resolver replaces the imported file with a same-named declaration.",
				"",
				"Reproduction: Resolve two same-named declarations through one caller.",
				"",
				"Impact: Usage is attributed to the wrong declaration.",
				"",
				"Required correction:",
				"- Preserve the defining-file identity and assert the selected declaration.",
			].join("\n"),
		);

		expect(document.missing_fields()).toEqual([]);
	});

	test.each([
		["affected paths", "Affected paths:\n\nInvariant:", "Affected paths"],
		["evidence", "Evidence:\n\nReproduction:", "Evidence"],
		["required correction", "Required correction:\n\n", "Required correction"],
		["an empty affected path item", "Affected paths:\n-   \n\nInvariant:", "Affected paths"],
	])("rejects %s while retaining every required label", (_name, replacement, missing) => {
		const valid = [
			"# Finding",
			"Severity: Major",
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
		const targets = new Map([
			["Affected paths", "Affected paths:\n- `src/source.ts`"],
			["Evidence", "Evidence:\n- The selected source is replaced."],
			["Required correction", "Required correction:\n- Preserve the source identity."],
		]);
		const target = targets.get(missing) ?? "Affected paths:\n- `src/source.ts`";
		const document = new ReviewFindingDocument(valid.replace(target, replacement));

		expect(document.missing_fields()).toContain(missing);
	});

	test("does not accept required labels found only in code fences", () => {
		const document = new ReviewFindingDocument(
			[
				"# Incomplete finding",
				"```md",
				"Severity: Major",
				"Status: Open",
				"Task: Preserve the invariant.",
				"Affected paths:",
				"- `src/source.ts`",
				"Invariant: Keep source ownership.",
				"Evidence:",
				"- The source is replaced.",
				"Reproduction: Import two declarations.",
				"Impact: Usage is misattributed.",
				"Required correction:",
				"- Keep the defining source.",
				"```",
			].join("\n"),
		);

		expect(document.missing_fields()).toHaveLength(9);
	});

	test("recognizes a resolved status after section headings", () => {
		const document = new ReviewFindingDocument("# Closed finding\n## Status\nStatus: Resolved\n");

		expect(document.status()).toBe("Status: Resolved");
	});
});
