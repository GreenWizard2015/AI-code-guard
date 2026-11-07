import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("callable type aliases", () => {
	test("requires inline function types to use Callable-prefixed aliases in both languages", () => {
		const fixture = new TestFixture();
		const violations = fixture
			.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
				{
					"callbacks.ts": [
						"type Handler = (value: string) => void;",
						"type CallableHandler = (value: string) => void;",
						"type Service = { handler: (value: string) => void };",
						"type CallableServiceHandler = (value: string) => void;",
						"type ServiceContract = { handler: CallableServiceHandler };",
						"",
						"export {};",
					].join("\n"),
					"callbacks.py": [
						"from typing import Callable, TypeAlias",
						"Handler: TypeAlias = Callable[[str], None]",
						"CallableHandler: TypeAlias = Callable[[str], None]",
						"",
						"def subscribe(callback: Callable[[str], None]) -> None:",
						"    return None",
						"",
						"def subscribe_named(callback: CallableHandler) -> None:",
						"    return None",
					].join("\n"),
				},
				(production_lint_configuration, options, mode) =>
					production_lint_configuration.lint_report(options, mode).report.violations,
			)
			.filter((violation) => violation.rule_id() === "callable-type-alias");

		const locations = violations
			.map((violation) => [violation.file(), violation.line()] as const)
			.sort(
				([left_file, left_line], [right_file, right_line]) =>
					left_file.localeCompare(right_file) || left_line - right_line,
			);
		expect(locations).toEqual([
			["callbacks.py", 2],
			["callbacks.py", 5],
			["callbacks.ts", 1],
			["callbacks.ts", 3],
		]);
	});

	test("accepts callable contracts referenced through Callable-prefixed aliases", () => {
		const fixture = new TestFixture();
		const violations = fixture
			.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
				{
					"callbacks.ts": [
						"type CallableHandler = (value: string) => void;",
						"type HandlerContract = { register(callback: CallableHandler): void };",
					].join("\n"),
					"callbacks.py": [
						"from typing import Callable, TypeAlias",
						"CallableHandler: TypeAlias = Callable[[str], None]",
						"def subscribe(callback: CallableHandler) -> None:",
						"    return None",
					].join("\n"),
				},
				(production_lint_configuration, options, mode) =>
					production_lint_configuration.lint_report(options, mode).report.violations,
			)
			.filter((violation) => violation.rule_id() === "callable-type-alias");

		expect(violations).toEqual([]);
	});
});
