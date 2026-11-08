import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { DETERMINISTIC_FUNCTION_FILES } from "tests/core/constants/ast_nodes/constants";
import { TestFixture } from "tests/core/test-fixture";

describe("shared parameter function diagnostics", () => {
	test("excludes test callables and ignores incomplete TypeScript metadata", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"production.py": [
					"class SharedInput:",
					"    pass",
					"",
					"def first(value: SharedInput):",
					"    return value",
					"",
					"def second(value: SharedInput):",
					"    return value",
				].join("\n"),
				"tests/shared_test.py": [
					"def fourth(value: SharedInput):",
					"    return value",
					"",
					"def fifth(value: SharedInput):",
					"    return value",
				].join("\n"),
				"missing.ts": [
					"function first(value) { return value; }",
					"function second(value: SharedInput) { return value; }",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(test_fixture.shared_violations(violations)).toEqual([]);
	});

	test("keeps function diagnostics deterministic and anchored to the first location", () => {
		const test_fixture = new TestFixture();

		const reversed = Object.fromEntries(Object.entries(DETERMINISTIC_FUNCTION_FILES).reverse());
		const first_violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			DETERMINISTIC_FUNCTION_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const second_violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			reversed,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const first = test_fixture.shared_violations(first_violations);
		const second = test_fixture.shared_violations(second_violations);
		const first_messages = first.map((violation) => violation.message().replaceAll(/(?:a|b)\.ts:/g, ""));
		const second_messages = second.map((violation) => violation.message().replaceAll(/(?:a|b)\.ts:/g, ""));
		const first_locations = first.map((violation) => ({
			rule_id: violation.rule_id(),
			line: violation.line(),
			file_is_first_source: violation.file().endsWith("a.ts"),
			hint_mentions_first_candidate: violation.hint().includes("a.ts:2 first"),
		}));
		const expected_messages = [
			'multiple functions share parameter set "value:SharedInput" (4). Candidates: 2 first; 3 second; 1 third; 2 fourth.',
		];

		expect({ first_messages, second_messages, first_locations }).toEqual({
			first_messages: expected_messages,
			second_messages: expected_messages,
			first_locations: [
				{ rule_id: "shared-parameter", line: 2, file_is_first_source: true, hint_mentions_first_candidate: false },
			],
		});
	});

	test("omits file names from method candidates but retains the violation location", () => {
		const test_fixture = new TestFixture();

		const methods = Array.from({ length: 4 }, (_, index) => `  method${index}(value: SharedInput) { return value; }`);
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"service.ts": ["class SharedInput {}", "class Service {", methods.join("\n"), "}"].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const diagnostic = test_fixture
			.shared_violations(violations)
			.find((item) => item.message().includes("multiple methods"));
		let result = { line: 0, file: false, method: false, file_in_message: false };
		if (diagnostic !== undefined) {
			const message = diagnostic.message();
			result = {
				line: diagnostic.line(),
				file: diagnostic.file().endsWith("service.ts"),
				method: message.includes("Service.method0"),
				file_in_message: message.includes("service.ts:"),
			};
		}

		expect(result).toEqual({ line: 3, file: true, method: true, file_in_message: false });
	});
});
