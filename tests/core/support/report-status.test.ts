import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { describe, expect, test } from "@jest/globals";
import { ReportStatus } from "src/core/support/report_status";
import type { ReportViolation } from "src/types";

/** Responsibilities: _violation fixture creation_, _priority scenario setup_. **/
class ReportStatusFixture {
	/** Responsibilities: _creation reporting violation fixture_. **/
	public violation(file: string, priority: ReportViolation["priority"], message: string): ReportViolation {
		return {
			file,
			line: 1,
			message,
			hint: "fix",
			rule_id: "parse-error",
			priority,
		};
	}
}

describe("report status", () => {
	test("summarizes diagnostics", () => {
		const fixture = new ReportStatusFixture();
		const status = new ReportStatus([
			fixture.violation("a.ts", 2, "priority 2"),
			fixture.violation("b.ts", 1, "priority 1"),
		]);
		expect(status.summary()).toBe("Total issues: 2.\nTotal files: 2.");
	});

	test("priority 1 does not fail", () => {
		const fixture = new ReportStatusFixture();
		const status = new ReportStatus([fixture.violation("a.ts", 1, "priority 1")]);
		expect(status.warnings()).toBe(false);
	});

	test("priority 0 fails", () => {
		const fixture = new ReportStatusFixture();
		const status = new ReportStatus([fixture.violation("a.ts", 0, "priority 0")]);
		expect(status.warnings()).toBe(true);
	});

	test("priorities 2 and 3 fail", () => {
		const fixture = new ReportStatusFixture();
		const priority_2_status = new ReportStatus([fixture.violation("a.ts", 2, "priority 2")]);
		const priority_3_status = new ReportStatus([fixture.violation("a.ts", 3, "priority 3")]);
		expect({ priority_2: priority_2_status.warnings(), priority_3: priority_3_status.warnings() }).toEqual({
			priority_2: true,
			priority_3: true,
		});
	});

	test("summary counts diagnostics without classifying their priorities", () => {
		const fixture = new ReportStatusFixture();
		const violations = Array.from({ length: 9 }, (_, priority) =>
			fixture.violation(`priority-${priority}.ts`, priority, `priority ${priority}`),
		);
		const status = new ReportStatus(violations);
		expect(status.summary()).toBe("Total issues: 9.\nTotal files: 9.");
	});

	test("empty status does not fail", () => {
		const status = new ReportStatus([]);
		expect({ summary: status.summary(), warnings: status.warnings() }).toEqual({
			summary: "Total issues: 0.\nTotal files: 0.",
			warnings: false,
		});
	});

	test("functions files do not fail with no diagnostics", () => {
		const status = new ReportStatus([]);
		expect({
			summary: status.summary(),
			warnings: status.warnings(),
		}).toEqual({
			summary: "Total issues: 0.\nTotal files: 0.",
			warnings: false,
		});
	});
});
