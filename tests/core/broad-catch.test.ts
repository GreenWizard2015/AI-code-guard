import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("broad catch diagnostics", () => {
	test("reports a catch that binds but does not narrow an arbitrary error", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"task-runner.ts": [
					"export class TaskRunner {",
					"\tpublic run_task(task: () => void): void {",
					"\t\ttry {",
					"\t\t\ttask();",
					"\t\t} catch (error) {",
					"\t\t\tconsole.error(error);",
					"\t\t}",
					"\t}",
					"}",
				].join("\n"),
				"bare-catch.ts": "function run_task(): void { try { perform(); } catch { return; } }",
				"rethrow.ts": [
					"function run_task(task: () => void): void {",
					"\ttry { task(); } catch (error) { throw error; }",
					"}",
				].join("\n"),
				"preserve-cause.ts": [
					"function run_task(task: () => void): void {",
					"\ttry { task(); } catch (error) {",
					'\t\tthrow new Error("Task failed", { cause: error });',
					"\t}",
					"}",
				].join("\n"),
				"cleanup-finally-rethrow.ts": [
					"function publish(): void {",
					"\ttry { stage(); } catch (error) {",
					"\t\ttry { cleanup(); } finally { throw error; }",
					"\t}",
					"}",
				].join("\n"),
				"narrowed.ts": [
					"function run_task(task: () => void): void {",
					"\ttry { task(); } catch (error) {",
					"\t\tif (error instanceof TypeError) { return; } else { throw error; }",
					"\t}",
					"}",
				].join("\n"),
				"partially-narrowed.ts": [
					"function run_task(task: () => void): void {",
					"\ttry { task(); } catch (error) {",
					"\t\tif (error instanceof TypeError) { return; }",
					"\t}",
					"}",
				].join("\n"),
				"unmatched-predicate.ts": [
					"function run_task(task: () => void): void {",
					"\ttry { task(); } catch (error) {",
					"\t\tif (is_expected_boundary_failure(error)) { return; }",
					"\t}",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((item) => item.rule_id() === "broad-except")
				.map((item) => item.file())
				.sort(),
		).toEqual(["bare-catch.ts", "partially-narrowed.ts", "unmatched-predicate.ts"]);
	});

	test("accepts an explicit return for a handled error and rethrows every other value", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"handled-errors.ts": [
					"function run_task(task: () => void): void {",
					"\ttry {",
					"\t\ttask();",
					"\t} catch (error) {",
					"\t\tif (error instanceof TypeError) {",
					"\t\t\treturn;",
					"\t\t}",
					"\t\tthrow error;",
					"\t}",
					"}",
				].join("\n"),
				"boundary-predicate.ts": [
					"function run_task(task: () => void): void {",
					"\ttry { task(); } catch (error) {",
					"\t\tif (!is_expected_boundary_failure(String(error))) { throw error; }",
					"\t\treturn;",
					"\t}",
					"}",
				].join("\n"),
				"classified-boundary-message-alias.ts": [
					"function remove_temporary_file(): void {",
					"\ttry { remove_file(); } catch (error) {",
					"\t\tconst message = String(error);",
					"\t\tif (!is_system_failure(message)) { throw error; }",
					'\t\tif (!message.includes("ENOENT")) { throw error; }',
					"\t}",
					"}",
				].join("\n"),
				"transaction-rollback.ts": [
					"function publish(): void {",
					"\ttry { stage(); commit(); } catch (error) {",
					"\t\tsnapshot.restore_failure(String(error));",
					"\t}",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id() === "broad-except")).toHaveLength(0);
	});

	test("accepts a catch limited to JSON parsing and rejects wider work", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"json-boundary.ts": [
					"function decode(text: string): { stdout: string; exit_code: number } {",
					"\ttry { return JSON.parse(text); }",
					'\tcatch { return { stdout: "invalid JSON", exit_code: 1 }; }',
					"}",
				].join("\n"),
				"wider-boundary.ts": [
					"function decode(text: string): { stdout: string; exit_code: number } {",
					"\ttry { const value = JSON.parse(text); validate(value); return value; }",
					'\tcatch { return { stdout: "invalid", exit_code: 1 }; }',
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id() === "broad-except").map((item) => item.file())).toEqual([
			"wider-boundary.ts",
		]);
	});

	test("accepts error conversion around one imported VM execution call", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"vm-boundary.ts": [
					'import { runInContext } from "node:vm";',
					"function execute(context: object): { done: boolean; error: string } {",
					'\ttry { runInContext("void 0", context); }',
					"\tcatch (error) { return { done: true, error: String(error) }; }",
					'\treturn { done: true, error: "" };',
					"}",
				].join("\n"),
				"expanded-vm-boundary.ts": [
					'import { runInContext } from "node:vm";',
					"function execute(context: object): { done: boolean; error: string } {",
					'\ttry { runInContext("void 0", context); cleanup(); }',
					"\tcatch (error) { return { done: true, error: String(error) }; }",
					'\treturn { done: true, error: "" };',
					"}",
				].join("\n"),
				"assigned-vm-result.ts": [
					'import { runInContext } from "node:vm";',
					"function execute(context: object): string {",
					"\tlet result: unknown;",
					'\ttry { result = runInContext("42", context); }',
					"\tcatch (error) { return String(error); }",
					"\treturn String(result);",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id() === "broad-except")).toHaveLength(0);
	});
});
