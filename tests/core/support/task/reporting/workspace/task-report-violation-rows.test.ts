import { describe, expect, test } from "@jest/globals";
import { REPORT_RULE_DISPLAY_LIMIT } from "src/core/support/task/constants";
import { TaskReportViolationRows } from "src/core/support/task/reporting/workspace/task_report_violation_rows";
import { ViolationValue } from "src/model/violation_value";
import type { ViolationContract } from "src/reporting_protocols";

describe("task report violation rows", () => {
	test("orders visible rules by frequency", () => {
		const rows = new TaskReportViolationRows([
			new ViolationValue({ file: "a.ts", line: 1, rule_id: "rule_b", message: "b", hint: "b", priority: 1 }),
			new ViolationValue({ file: "a.ts", line: 2, rule_id: "rule_a", message: "a", hint: "a", priority: 1 }),
			new ViolationValue({ file: "b.ts", line: 1, rule_id: "rule_b", message: "b", hint: "b", priority: 1 }),
		]);

		expect(rows.visible_rows()).toEqual(["| `rule_b` | 2 | 2 |", "| `rule_a` | 1 | 1 |"]);
	});

	test("counts overflow rules and their distinct files", () => {
		const violations: ViolationContract[] = Array.from({ length: REPORT_RULE_DISPLAY_LIMIT + 2 }, (_, index) => {
			const suffix = String.fromCharCode("a".charCodeAt(0) + index);
			return new ViolationValue({
				file: index < REPORT_RULE_DISPLAY_LIMIT + 1 ? "a.ts" : "b.ts",
				line: index + 1,
				rule_id: `sample_rule_${suffix}`,
				message: "problem",
				hint: "fix",
				priority: 1,
			});
		});
		const rows = new TaskReportViolationRows(violations);

		expect({
			visible_count: rows.visible_rows().length,
			remaining: rows.remaining_row(),
		}).toEqual({
			visible_count: REPORT_RULE_DISPLAY_LIMIT,
			remaining: "| Others | 2 | 2 |",
		});
	});
});
