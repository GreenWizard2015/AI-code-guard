import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { TaskFileSelector } from "src/core/support/task/task_file_selector";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { RULE_DATA } from "src/constants";
import { TaskReportingMemoryFixture } from "tests/bridge/ts/core/support/task-reporting-memory-fixture";
import { TaskReporting } from "src/core/support/task_reporting";

describe("architectural transformation priority", () => {
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
				priorities: [small.priority, large.priority],
				first: first.files,
				next: next.files,
			}).toEqual({ priorities: [7, 3], first: ["/project/z-small.ts"], next: ["/project/a-large.ts"] });
		},
	);

	test("places modules before resolving imports and splitting files", () => {
		const placement = RULE_DATA["module-placement"].priority;
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
			priorities: [small.priority, large[0]?.priority, lower_priority[0]?.priority],
			files: result.files,
		}).toEqual({
			priorities: [7, 7, 3],
			files: ["/project/large-a.ts", "/project/large-b.ts"],
		});
	});

	test("keeps directory splits below relocation and above local naming", () => {
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
				directory_split.priority,
				class_split.priority,
				RULE_DATA["module-placement"].priority,
				naming.priority,
			],
			files: [directory_selected.files, class_selected.files],
		}).toEqual({ priorities: [3, 3, 7, 2], files: [["/project/directory"], ["/project/class-directory"]] });
	});

	test.each(["top-category", "all"] as const)("%s selects relocation before an import-only file", (policy) => {
		const placement = new DiagnosticRule("module-placement");
		const imports = new DiagnosticRule("missing-import");
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create({
			"a-import.ts": 'import { Order } from "./missing";',
			"z-move.ts": "export class Order {}",
		});
		const root = fixture.root;
		const reporting = new TaskReporting(fixture.root, {
			file_io: fixture.file_io,
			documentation: fixture.documentation,
		});
		const move = placement.violation("z-move.ts", 1, {
			target: "z-move.ts",
			importers: "a-import.ts",
			members: "Order",
			placement_message: "module is misplaced",
			suggestions: "orders/order.ts",
			guidance: "Keep the module with its owner.",
		});
		reporting.format([imports.violation("a-import.ts", 1, { specifier: "./missing" }), move], {
			batch_size: 1,
			policy,
			skip_review: false,
		});
		const document = fixture.file_io.file_content.file_text(join(root, ".ai-code-guard/issues.md"));
		expect({
			moved_file: document.includes(`## ${join(root, "z-move.ts")}`),
			import_file: document.includes(`## ${join(root, "a-import.ts")}`),
			destination: document.includes("orders/order.ts"),
		}).toEqual({ moved_file: true, import_file: false, destination: true });
	});
});
