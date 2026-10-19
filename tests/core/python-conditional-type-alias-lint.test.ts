import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("Python conditional type alias rule", () => {
	test("reports conditional type declarations across branch shapes", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"case-01.py":
					"if runtime_mode:\n    FirstValue: Alias = Request | Cache\nelse:\n    RuntimeValue: Alias = Request",
				"case-02.py": "if enabled:\n    ResultType: AliasMarker = RuntimeType",
				"case-03.py": "if enabled:\n    value = load_value()\nelse:\n    ResultType: AliasMarker = package.RuntimeType",
				"case-04.py": "if enabled:\n    ResultType: AliasMarker = list[RuntimeType]",
				"case-05.py":
					"if enabled:\n    UnionType: AliasMarker = FirstType | SecondType\n    IntersectionType: AliasMarker = FirstType & SecondType",
				"case-06.py":
					"if first_mode:\n    value = load_value()\nelif second_mode:\n    ResultType: AliasMarker = RuntimeType",
				"case-07.py": "if outer_mode:\n    if inner_mode:\n        ResultType: AliasMarker = RuntimeType",
				"case-08.py": "if runtime_mode:\n    with context:\n        ResultType = RuntimeType | FallbackType",
				"case-09.py": "if runtime_mode:\n    Value = int\nelse:\n    Value = str",
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode),
		);
		const reported_files = execution.report.violations
			.filter((violation) => violation.rule_id === "python-conditional-type-alias")
			.map((violation) => violation.file.split("/").at(-1));

		expect(reported_files).toEqual([
			"case-01.py",
			"case-02.py",
			"case-03.py",
			"case-04.py",
			"case-05.py",
			"case-06.py",
			"case-07.py",
			"case-08.py",
			"case-09.py",
		]);
	});

	test("allows runtime assignments and annotations without values", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"ordinary-branch.py": "if runtime_mode:\n    value = load_value()\nelse:\n    value = fallback_value()",
				"typed-runtime.py": "if enabled:\n    value: FirstType = first_value",
				"annotation-only.py": "if enabled:\n    ResultType: AliasMarker",
				"lowercase-value.py": "if enabled:\n    result_type: AliasMarker = RuntimeType",
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode),
		);

		expect(
			execution.report.violations.filter((violation) => violation.rule_id === "python-conditional-type-alias"),
		).toHaveLength(0);
	});
});
