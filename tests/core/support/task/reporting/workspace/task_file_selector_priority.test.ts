import { describe, expect, test } from "@jest/globals";
import { RULE_DATA } from "src/constants";
import { TaskFileSelector } from "src/core/support/task/reporting/workspace/task_file_selector";
import { DiagnosticRule } from "src/model/diagnostic_rule";

describe("transformation rule priority", () => {
	test("creates zero-priority diagnostics for string literal rules", () => {
		const rule_ids = ["non-english-source-text", "repeated-literal", "literal-constant-reuse"];
		const violations = rule_ids.map((rule_id) => {
			let parameters = {};
			if (rule_id === "literal-constant-reuse") {
				parameters = { constant: "SHARED_MESSAGE" };
			}
			const rule = new DiagnosticRule(rule_id);
			return rule.violation("messages.ts", 1, parameters);
		});

		expect(violations.map((violation) => [violation.rule_id(), violation.priority()])).toEqual([
			["non-english-source-text", 0],
			["repeated-literal", 0],
			["literal-constant-reuse", 0],
		]);
	});

	test.each(["directory", "directory-class", "file", "class", "callable", "test", "typescript-jest"])(
		"handles %s minimum size before splitting oversized units",
		(prefix) => {
			const minimum = new DiagnosticRule(`${prefix}-min-size`);
			const maximum = new DiagnosticRule(`${prefix}-max-size`);
			const small = minimum.violation("z-small.ts", 1, { count: "1", size: "1", callable: "method" });
			const large = maximum.violation("a-large.ts", 1, { count: "501", size: "501", callable: "method" });
			const selector = new TaskFileSelector("/project");
			const first = selector.select_top_category([large, large, small], 1);
			const next = selector.select_top_category([large, large], 1);
			expect({
				priorities: [small.priority(), large.priority()],
				first: first.files,
				next: next.files,
			}).toEqual({ priorities: [7, 3], first: ["/project/z-small.ts"], next: ["/project/a-large.ts"] });
		},
	);

	test("places modules before resolving imports and splitting files", () => {
		const placement_rule_id = "module-placement";
		const placement = RULE_DATA[placement_rule_id].priority;
		const selector = new TaskFileSelector("/project");
		const placement_rule = new DiagnosticRule("module-placement");
		const import_rule = new DiagnosticRule("missing-import");
		const file_size_rule = new DiagnosticRule("file-max-size");
		const relocation = placement_rule.violation("module.ts", 1, {
			target: "module.ts",
			members: "Module",
			importers: "consumer.ts",
			placement_message: "misplaced",
			suggestions: "module/module.ts",
			guidance: "move the module",
		});
		const import_error = import_rule.violation("consumer.ts", 1, { specifier: "./missing" });
		const split_file = file_size_rule.violation("large.ts", 1, { count: "501" });
		const selected = selector.select_top_category([import_error, split_file, relocation], 1);
		expect({
			placement_priority: placement,
			selected_files: selected.files,
		}).toEqual({ placement_priority: 7, selected_files: ["/project/module.ts"] });
	});

	test("selects the largest rule group within the highest priority", () => {
		const small_rule = new DiagnosticRule("class-min-size");
		const large_rule = new DiagnosticRule("module-placement");
		const lower_priority_rule = new DiagnosticRule("callable-max-size");
		const small = small_rule.violation("small.ts", 1, { count: "1" });
		const large = [
			large_rule.violation("large-a.ts", 1, {
				target: "A",
				members: "A",
				importers: "consumer.ts",
				placement_message: "misplaced",
				suggestions: "a.ts",
				guidance: "move it",
			}),
			large_rule.violation("large-b.ts", 1, {
				target: "B",
				members: "B",
				importers: "consumer.ts",
				placement_message: "misplaced",
				suggestions: "b.ts",
				guidance: "move it",
			}),
		];
		const lower_priority = [
			lower_priority_rule.violation("lower-a.ts", 1, { callable: "method" }),
			lower_priority_rule.violation("lower-b.ts", 1, { callable: "method" }),
			lower_priority_rule.violation("lower-c.ts", 1, { callable: "method" }),
		];
		const selector = new TaskFileSelector("/project");
		const result = selector.select_top_category([small, ...large, ...lower_priority], 10);
		expect({
			priorities: [
				small.priority(),
				large.map((item) => item.priority()),
				lower_priority.map((item) => item.priority()),
			],
			files: result.files,
		}).toEqual({
			priorities: [7, [7, 7], [3, 3, 3]],
			files: ["/project/large-a.ts", "/project/large-b.ts"],
		});
	});

	test("selects files by priority and emits every finding in each selected file", () => {
		const class_minimum = new DiagnosticRule("class-min-size");
		const callable_minimum = new DiagnosticRule("callable-min-size");
		const callable_maximum = new DiagnosticRule("callable-max-size");
		const naming = new DiagnosticRule("naming");
		const class_high = class_minimum.violation("a-high.ts", 1, { count: "1" });
		const callable_high = callable_minimum.violation("a-high.ts", 2, { callable: "method" });
		const naming_lower = naming.violation("a-high.ts", 3, {
			kind: "class",
			name: "bad_name",
			word_count: "7",
		});
		const other_class_high = class_minimum.violation("z-high.ts", 1, { count: "1" });
		const callable_lower = callable_maximum.violation("m-lower.ts", 1, { callable: "method" });
		const violations = [class_high, callable_high, naming_lower, other_class_high, callable_lower];
		const selector = new TaskFileSelector("/project");
		const complete = selector.select_all(violations, 10);
		const capped = selector.select_all(violations, 1);

		expect({
			priorities: [class_high.priority(), callable_high.priority(), naming_lower.priority(), callable_lower.priority()],
			files: complete.files,
			selected: complete.violations.map((violation) => `${violation.file()}:${violation.rule_id()}`),
			capped_files: capped.files,
			capped_rules: capped.violations.map((violation) => violation.rule_id()),
		}).toEqual({
			priorities: [7, 7, 2, 3],
			files: ["/project/a-high.ts", "/project/z-high.ts", "/project/m-lower.ts"],
			selected: [
				"a-high.ts:class-min-size",
				"a-high.ts:callable-min-size",
				"a-high.ts:naming",
				"z-high.ts:class-min-size",
				"m-lower.ts:callable-max-size",
			],
			capped_files: ["/project/a-high.ts"],
			capped_rules: ["class-min-size", "callable-min-size", "naming"],
		});
	});
});
