import "src/linting/composition/composition_model";
import "src/callable_usage";
import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { PYTHON_USAGE_FILES } from "tests/core/constants/callable_usage/constants";
import { TestFixture } from "tests/core/test-fixture";

describe("Python callable usage diagnostics", () => {
	const test_fixture = new TestFixture();

	test("applies production usage rules to functions and methods", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			PYTHON_USAGE_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const existing_rule_violations = violations.filter(
			(violation) => !violation.rule_id().startsWith("responsibilities"),
		);
		const messages = existing_rule_violations.map((violation) => violation.message());
		expect({
			once: messages.includes(
				'function "once" has insufficient production usage (found 1 other production file; candidate for removal/refactor)',
			),
			service_once: messages.includes(
				'method "Service.once" has insufficient production usage (found 1 other production file; candidate for removal/refactor)',
			),
			local_only: messages.some((message) => message.includes('function "local_only"')),
			private_function: messages.some((message) => message.includes('function "_private_function" is used')),
			private_method: messages.some((message) => message.includes('method "Service._private_method" is used')),
			twice: messages.some((message) => message.includes('function "twice" is used')),
			service_twice: messages.some((message) => message.includes('method "Service.twice" is used')),
		}).toEqual({
			once: false,
			service_once: false,
			local_only: false,
			private_function: false,
			private_method: false,
			twice: false,
			service_twice: false,
		});
	});

	test("reports Python callables referenced only from tests", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"source.py":
					"def read_value() -> int: return 1\nclass Service:\n def read(self) -> int: return 1\n def other(self) -> int: return 2",
				"tests/test_usage.py":
					"from source import Service, read_value\nservice = Service()\nread_value()\nservice.read()",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect({
			test_only_count: violations.filter((violation) => violation.rule_id() === "test-only-usage").length,
			unused_callable_messages: violations
				.filter((violation) => violation.rule_id() === "unused-callable")
				.map((violation) => violation.message()),
		}).toEqual({
			test_only_count: 2,
			unused_callable_messages: [
				'method "Service.other" has insufficient production usage (found 0 other production files; candidate for removal/refactor)',
			],
		});
	});
});
