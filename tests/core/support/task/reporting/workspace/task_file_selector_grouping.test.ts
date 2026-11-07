import { describe, expect, test } from "@jest/globals";
import { RULE_DATA } from "src/constants";
import { TaskFileSelector } from "src/core/support/task/reporting/workspace/task_file_selector";
import { DiagnosticRule } from "src/model/diagnostic_rule";

describe("transformation batch grouping", () => {
	test("selects the requested file grouping policy", () => {
		const selector = new TaskFileSelector("/project");
		const directory_rule = new DiagnosticRule("directory-max-size");
		const class_directory_rule = new DiagnosticRule("directory-class-max-size");
		const violations = [
			directory_rule.violation("a-directory", 1, { count: "501", size: "501" }),
			class_directory_rule.violation("b-class-directory", 1, { count: "501", size: "501" }),
			class_directory_rule.violation("c-class-directory", 1, { count: "501", size: "501" }),
		];
		const top_category = selector.select_top_category(violations, 10);
		const all = selector.select_all(violations, 10);

		expect({ top_category: top_category.files, all: all.files }).toEqual({
			top_category: ["/project/b-class-directory", "/project/c-class-directory"],
			all: ["/project/a-directory", "/project/b-class-directory", "/project/c-class-directory"],
		});
	});

	test("keeps directory splits below relocation and above local naming", () => {
		const placement_rule_id = "module-placement";
		const selector = new TaskFileSelector("/project");
		const directory_rule = new DiagnosticRule("directory-max-size");
		const class_directory_rule = new DiagnosticRule("directory-class-max-size");
		const naming_rule = new DiagnosticRule("naming");
		const directory_split = directory_rule.violation("directory", 1, {
			count: "501",
			size: "501",
		});
		const class_split = class_directory_rule.violation("class-directory", 1, {
			count: "501",
			size: "501",
		});
		const naming = naming_rule.violation("name.ts", 1, {
			kind: "method",
			name: "bad_name",
			word_count: "7",
		});
		const directory_selected = selector.select_top_category([naming, directory_split], 1);
		const class_selected = selector.select_top_category([naming, class_split], 1);
		expect({
			priorities: [
				directory_split.priority(),
				class_split.priority(),
				RULE_DATA[placement_rule_id].priority,
				naming.priority(),
			],
			files: [directory_selected.files, class_selected.files],
		}).toEqual({ priorities: [3, 3, 7, 2], files: [["/project/directory"], ["/project/class-directory"]] });
	});

	test("select_top_category chooses the largest category after directory suppression", () => {
		const selector = new TaskFileSelector("/project");
		const directory_rule = new DiagnosticRule("directory-max-size");
		const nested_directory_rule = new DiagnosticRule("directory-class-max-size");
		const file_rule = new DiagnosticRule("file-max-size");
		const parent = directory_rule.violation("src/package", 1, { count: "501", size: "501" });
		const nested = nested_directory_rule.violation("src/package/feature", 1, { count: "501", size: "501" });
		const nested_file = file_rule.violation("src/package/feature/item.ts", 1, { count: "501" });
		const sibling_files = [
			file_rule.violation("src/peer/first.ts", 1, { count: "501" }),
			file_rule.violation("src/peer/second.ts", 1, { count: "501" }),
		];
		const selected = selector.select_top_category([parent, nested, nested_file, ...sibling_files], 10);

		expect({
			files: selected.files,
			violations: selected.violations.map((violation) => violation.file()),
		}).toEqual({
			files: ["/project/src/peer/first.ts", "/project/src/peer/second.ts"],
			violations: ["src/peer/first.ts", "src/peer/second.ts"],
		});
	});
});
