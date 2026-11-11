import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { TaskReporting } from "src/core/support/task/reporting/workspace/task_reporting";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { TaskReportingMemoryFixture } from "tests/bridge/ts/core/support/task-reporting-memory-fixture";

describe("transformation reporting selection", () => {
	test.each(["top-category", "all"] as const)("%s selects relocation before an import-only file", (policy) => {
		const placement = new DiagnosticRule("module-placement");
		const imports = new DiagnosticRule("missing-import");
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create({
			"a-import.ts": 'import { Order } from "./missing";',
			"z-move.ts": "export class Order {}",
		});
		const root = fixture._root;
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
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
		const document = fixture._file_io.file(join(root, ".ai-code-guard/issues.md")).file_text();
		expect({
			moved_file: document.includes(`## ${join(root, "z-move.ts")}`),
			import_file: document.includes(`## ${join(root, "a-import.ts")}`),
			destination: document.includes("orders/order.ts"),
		}).toEqual({ moved_file: true, import_file: false, destination: true });
	});

	test("all policy reports directory and nested-file findings together", () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create({
			"src/parser/child.ts": "export class Child {}",
			"src/other.ts": "export class Other {}",
		});
		const root = fixture._root;
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		const directory_rule = new DiagnosticRule("directory-class-min-size");
		const directory_file_rule = new DiagnosticRule("directory-min-size");
		const import_rule = new DiagnosticRule("missing-import");
		const directory_finding = directory_rule.violation("src/parser", 1, { count: "1" });
		const directory_file_finding = directory_file_rule.violation("src/parser", 1, { count: "1" });
		const child_finding = import_rule.violation("src/parser/child.ts", 1, { specifier: "./missing" });
		const unrelated_finding = import_rule.violation("src/other.ts", 1, { specifier: "./missing" });

		reporting.format([directory_finding, directory_file_finding, child_finding, unrelated_finding], {
			batch_size: 10,
			policy: "all",
			skip_review: false,
		});
		const document = fixture._file_io.file(join(root, ".ai-code-guard/issues.md")).file_text();

		expect({
			selected_class_finding: document.includes("directory contains too few classes"),
			selected_file_finding: document.includes("directory contains too few files"),
			nested_file_finding: document.includes(`## ${join(root, "src/parser/child.ts")}`),
			unrelated_file_finding: document.includes(`## ${join(root, "src/other.ts")}`),
		}).toEqual({
			selected_class_finding: true,
			selected_file_finding: true,
			nested_file_finding: true,
			unrelated_file_finding: true,
		});
	});

	test("reports every diagnostic in each selected file", () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create({
			"a-high.ts": "export class High {}\n",
			"z-high.ts": "export class OtherHigh {}\n",
			"m-lower.ts": "export const lower = 1;\n",
		});
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		const class_minimum = new DiagnosticRule("class-min-size");
		const callable_minimum = new DiagnosticRule("callable-min-size");
		const callable_maximum = new DiagnosticRule("callable-max-size");
		const naming = new DiagnosticRule("naming");
		reporting.format(
			[
				class_minimum.violation("a-high.ts", 1, { count: "1" }),
				callable_minimum.violation("a-high.ts", 1, { callable: "method" }),
				naming.violation("a-high.ts", 1, { kind: "class", name: "bad_name", word_count: "7" }),
				class_minimum.violation("z-high.ts", 1, { count: "1" }),
				callable_maximum.violation("m-lower.ts", 1, { callable: "method" }),
			],
			{ batch_size: 10, policy: "all", skip_review: false },
		);
		const document = fixture._file_io.file(join(fixture._root, ".ai-code-guard/issues.md")).file_text();

		expect({
			high_tie_a: document.includes("# class-min-size") && document.includes("# callable-min-size"),
			high_tie_b: document.includes(`## ${join(fixture._root, "z-high.ts")}`),
			lower_priority_file: document.includes(`## ${join(fixture._root, "m-lower.ts")}`),
			same_file_lower_priority: document.includes("# naming"),
		}).toEqual({
			high_tie_a: true,
			high_tie_b: true,
			lower_priority_file: true,
			same_file_lower_priority: true,
		});
	});
});
