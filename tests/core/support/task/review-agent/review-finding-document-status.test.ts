import { describe, expect, test } from "@jest/globals";
import { REVIEW_FIELD_STATUS } from "src/core/support/task/review-agent/constants";
import { ReviewFindingDocument } from "src/core/support/task/review-agent/review_finding_document";

describe("review finding document status", () => {
	test.each([
		["tilde fence", "~~~md\nStatus: Resolved\n~~~"],
		["long backtick fence with a shorter inner sample", "````md\n```\nStatus: Resolved\n````"],
		["mismatched fence characters", "```md\n~~~\nStatus: Resolved\n```"],
	])("ignores lifecycle markers inside a %s", (_description, fenced_content) => {
		const document = new ReviewFindingDocument(`# Finding\n${fenced_content}\n`);

		expect(document.status()).toBe("");
	});

	test.each([
		["repeated open markers", "Status: Open\nStatus: Open\n"],
		["conflicting markers", "Status: Open\nStatus: Resolved\n"],
		["repeated resolved markers", "Status: Resolved\nStatus: Resolved\n"],
		["unknown status", "Status: Maybe\n"],
	])("rejects %s as a valid document status", (_description, status) => {
		const document = new ReviewFindingDocument(`# Finding\nSeverity: Major\n${status}Task: Keep the invariant.\n`);

		expect({ status: document.status(), missing_status: document.missing_fields() }).toEqual({
			status: "",
			missing_status: expect.arrayContaining([
				`${REVIEW_FIELD_STATUS} (use Status: Open or Status: Resolved exactly once)`,
			]),
		});
	});
});
