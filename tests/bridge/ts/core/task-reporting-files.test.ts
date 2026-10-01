import "src/bridge/ts/core/context-factory";
import "src/stage-timing";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { CliResultReporter } from "src/bridge/ts/core/support/cli-result-reporter";
import type { ReportViolation } from "src/types";
import { TestFixture } from "tests/core/test-fixture";

describe("coding-lint task reporting files", () => {
	/** Responsibilities: _construction task-reporting violation fixture_. **/
	const violation = (
		file: string,
		line: number,
		rule_id: string,
		priority: ReportViolation["priority"],
	): ReportViolation => ({
		file,
		line,
		message: `${rule_id} message`,
		hint: `${rule_id} hint`,
		rule_id,
		priority,
	});
	const reporting_files = {
		"a.ts": "const first = 1;\n",
		"b.ts": "const first = 1;\n",
	};

	test("writes different hints beside their corresponding lines", () => {
		const fixture = new TestFixture();
		const document = fixture.with_temporary_files("task-reporting-", reporting_files, (root, reporting) => {
			reporting.format(
				[
					{ ...violation("a.ts", 1, "module-placement", 3), hint: "move a" },
					{ ...violation("b.ts", 1, "module-placement", 3), hint: "move b" },
				],
				{ batch_size: 10, policy: "all", skip_review: false },
			);
			return readFileSync(join(root, ".ai-code-guard", "issues.md"), "utf8");
		});
		const first_line = document.indexOf("- Line 1: const first = 1;");
		expect({
			common_hint: document.indexOf("Hint: move a") < first_line,
			first_hint: document.split("Hint: move a").length - 1,
			second_hint: document.split("Hint: move b").length - 1,
		}).toEqual({ common_hint: false, first_hint: 1, second_hint: 1 });
	});

	test("clears stale task files", () => {
		const fixture = new TestFixture();
		const rules = fixture.with_temporary_files("task-batch-", reporting_files, (root, reporting) => {
			const rules = join(root, ".ai-code-guard", "rules");
			mkdirSync(rules, { recursive: true });
			writeFileSync(join(rules, "stale.md"), "stale");
			reporting.format([], { batch_size: 1, policy: "all", skip_review: false });
			return readdirSync(rules);
		});
		expect(rules).toEqual([]);
	});

	test("applies the batch size to all selected file problems", () => {
		const fixture = new TestFixture();
		const result = fixture.with_temporary_files("task-batch-", reporting_files, (root, reporting) => {
			const output = reporting.format(
				[
					violation("a.ts", 1, "parse-error", 3),
					violation("a.ts", 1, "unused-file", 2),
					violation("b.ts", 1, "parse-error", 3),
				],
				{ batch_size: 1, policy: "all", skip_review: false },
			);
			return {
				output,
				issue_document: readFileSync(join(root, ".ai-code-guard", "issues.md"), "utf8"),
			};
		});
		expect({
			output: result.output.includes("Total files: 1."),
			unused: result.issue_document.includes("Problem: unused-file message"),
		}).toEqual({ output: true, unused: true });
	});

	test("copies the rule document and writes absolute issue paths", () => {
		const fixture = new TestFixture();
		const result = fixture.with_temporary_files(
			"task-docs-",
			{ "source.ts": "const result = 1;\n" },
			(root, reporting) => {
				reporting.format([violation("source.ts", 1, "parse-error", 2)], {
					batch_size: 10,
					policy: "top-category",
					skip_review: false,
				});
				const task_root = join(root, ".ai-code-guard");
				return {
					rule_document: readFileSync(join(task_root, "rules", "parse-error.md"), "utf8"),
					agent_document: readFileSync(join(task_root, "architecture-review-agent.md"), "utf8"),
					issues: readFileSync(join(task_root, "issues.md"), "utf8"),
				};
			},
		);
		const agent_title = result.agent_document.includes("# Architecture review subagent instructions");
		const agent_access = result.agent_document.includes("read access");
		const agent_review_path = result.agent_document.includes(".ai-code-guard/review/");
		expect({
			rule_document: result.rule_document.includes("# `parse-error`"),
			agent_document: [agent_title, agent_access, agent_review_path].every(Boolean),
			issues: result.issues.includes("## ") && result.issues.includes("/source.ts"),
		}).toEqual({ rule_document: true, agent_document: true, issues: true });
	});

	test("reports priority zero diagnostics as problems", () => {
		const fixture = new TestFixture();
		const report = fixture.with_temporary_files("task-informational-", reporting_files, (root, reporting) => {
			reporting.format([violation("a.ts", 1, "responsibilities-wording", 0)], {
				batch_size: 10,
				policy: "top-category",
				skip_review: false,
			});
			return readFileSync(join(root, ".ai-code-guard", "report.md"), "utf8");
		});
		expect(report).toContain("| `responsibilities-wording` | 1 | 1 |");
	});

	test("writes the complete lint output to markdown", () => {
		const fixture = new TestFixture();
		const output = fixture.with_temporary_files("task-output-", reporting_files, (root, reporting) => {
			const lint_output = "1 info, 0 warning, 0 critical.\nTotal issues: 1.";
			reporting.workspace.write_lint_output(lint_output);
			return readFileSync(join(root, ".ai-code-guard", "lint-output.md"), "utf8");
		});
		expect(output).toBe("1 info, 0 warning, 0 critical.\nTotal issues: 1.\n");
	});

	test("captures the output produced by the CLI result reporter", () => {
		const fixture = new TestFixture();
		const result = fixture.with_temporary_files("task-reporter-", reporting_files, (root, reporting) => {
			const reporter = new CliResultReporter(
				{
					format: () => "lint output",
				},
				reporting.workspace,
			);
			reporter.report(
				{ files: [], violations: [] },
				{
					root,
					ignored_directories: [],
					entry_files: [],
					timings: false,
					skip_review: false,
					batch_size: 10,
					policy: "all",
				},
			);
			return readFileSync(join(root, ".ai-code-guard", "lint-output.md"), "utf8");
		});
		expect(result).toBe("lint output\n");
	});
});
