import { beforeEach, describe, expect, test } from "@jest/globals";
import { TaskReporting } from "src/core/support/task/reporting/workspace/task_reporting";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { TaskReportingMemoryFixture } from "tests/bridge/ts/core/support/task-reporting-memory-fixture";
import type { TaskReportingMemoryWorkspace } from "tests/bridge/ts/core/support/task-reporting-memory-workspace";

describe("task file fix plan reporting", () => {
	let fixture: TaskReportingMemoryWorkspace;
	let reporting: TaskReporting;
	const class_minimum = new DiagnosticRule("class-min-size");
	const callable_minimum = new DiagnosticRule("callable-min-size");
	const callable_maximum = new DiagnosticRule("callable-max-size");
	const directory_rule = new DiagnosticRule("directory-class-min-size");
	const placement_rule = new DiagnosticRule("module-placement");
	const naming = new DiagnosticRule("naming");
	const full_batch = { batch_size: 10, policy: "all" as const, skip_review: false };

	beforeEach(() => {
		const fixture_factory = new TaskReportingMemoryFixture();
		fixture = fixture_factory.create({
			"src/a.ts": "export class A {}\n",
			"src/b.ts": "export const b = 1;\n",
			"src/dir/child.ts": "export class Child {}\n",
			"src/placed.ts": "export class Placed {}\n",
		});
	});

	test("selects each file's maximum priority and every tied rule", () => {
		reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		reporting.format(
			[
				class_minimum.violation("src/a.ts", 1, { count: "1" }),
				callable_minimum.violation("src/a.ts", 2, { callable: "method" }),
				naming.violation("src/a.ts", 3, { kind: "class", name: "bad_name", word_count: "7" }),
				callable_maximum.violation("src/b.ts", 1, { callable: "method" }),
			],
			full_batch,
		);
		const report = fixture.task_text("report.md");

		expect({
			a_maximum_and_tie: report.includes(
				`| \`${fixture._root}/src/a.ts\` | 7 | \`callable-min-size\`, \`class-min-size\` | \`naming\` (1) | — | In current batch |`,
			),
			b_maximum: report.includes(
				`| \`${fixture._root}/src/b.ts\` | 3 | \`callable-max-size\` | — | — | In current batch |`,
			),
		}).toEqual({ a_maximum_and_tie: true, b_maximum: true });
	});

	test("keeps per-file rows sorted regardless of diagnostic order", () => {
		reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		const violations = [
			class_minimum.violation("src/a.ts", 1, { count: "1" }),
			callable_maximum.violation("src/b.ts", 1, { callable: "method" }),
		];
		reporting.format(violations, full_batch);
		const forward_report = fixture.task_text("report.md");
		violations.reverse();
		reporting.format(violations, full_batch);
		const reverse_report = fixture.task_text("report.md");

		expect(reverse_report).toBe(forward_report);
	});

	test("reports files outside the batch cap as deferred", () => {
		reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		reporting.format(
			[
				class_minimum.violation("src/a.ts", 1, { count: "1" }),
				callable_maximum.violation("src/b.ts", 1, { callable: "method" }),
			],
			{ batch_size: 1, policy: "all", skip_review: false },
		);
		const report = fixture.task_text("report.md");

		expect(report.includes(`| \`${fixture._root}/src/b.ts\` | 3 | — | — | — | Deferred by batch cap |`)).toBe(true);
	});

	test("explains directory suppression with the suppressing path", () => {
		reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		reporting.format(
			[
				directory_rule.violation("src/dir", 1, { count: "1" }),
				class_minimum.violation("src/dir/child.ts", 1, { count: "1" }),
			],
			full_batch,
		);
		const report = fixture.task_text("report.md");

		expect(report.includes(`class-min-size (line 1), directory suppression at \`${fixture._root}/src/dir\``)).toBe(
			true,
		);
	});

	test("explains placement suppression with the placed file path", () => {
		reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		reporting.format(
			[
				placement_rule.violation("src/placed.ts", 1, {
					target: "src/placed.ts",
					members: "Placed",
					importers: "src/consumer.ts",
					placement_message: "module is misplaced",
					suggestions: "src/placed/placed.ts",
					guidance: "Move the module with its owner.",
				}),
				naming.violation("src/placed.ts", 2, { kind: "class", name: "bad_name", word_count: "7" }),
			],
			full_batch,
		);
		const report = fixture.task_text("report.md");

		expect(report.includes(`naming (line 2), placement suppression at \`${fixture._root}/src/placed.ts\``)).toBe(true);
	});
});
