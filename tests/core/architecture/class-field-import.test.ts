import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("imported class fields", () => {
	test("reports imported functions assigned to TypeScript class fields", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"top-level/top-level-helper.ts": "export function execute(): number { return 1; }",
				"top-level/top-level-service.ts": [
					"import { execute } from './top-level-helper';",
					"class Service { public run = execute; }",
				].join("\n"),
				"barrel/barrel-first.ts": "export function first(): number { return 1; }",
				"barrel/barrel-second.ts": "export function second(): number { return 2; }",
				"barrel/barrel.ts": [
					"export { first } from './barrel-first';",
					"export { second } from './barrel-second';",
				].join("\n"),
				"barrel/barrel-service.ts": [
					"import { first, second } from './barrel';",
					"class Service { public run = second; }",
				].join("\n"),
				"nested/nested-helper.ts": "export function execute(): number { return 1; }",
				"nested/nested-service.ts": [
					"import { execute } from './nested-helper';",
					"function build(): void {",
					"  class Service { public run = execute; }",
					"  void Service;",
					"}",
				].join("\n"),
				"expression/expression-helper.ts": "export function execute(): number { return 1; }",
				"expression/expression-service.ts": [
					"import { execute } from './expression-helper';",
					"const Service = class { public run = execute; };",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const locations = violations
			.filter((violation) => violation.rule_id() === "class-field-import")
			.map((violation) => ({ file: violation.file(), line: violation.line() }))
			.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line);

		expect(locations).toEqual([
			{ file: "barrel/barrel-service.ts", line: 2 },
			{ file: "expression/expression-service.ts", line: 2 },
			{ file: "nested/nested-service.ts", line: 3 },
			{ file: "top-level/top-level-service.ts", line: 2 },
		]);
	});

	test("reports Python imports and ignores names shadowed inside their classes", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"nested_python_helper.py": "def execute():\n    return 1\n",
				"nested_python_service.py": [
					"from .nested_python_helper import execute",
					"",
					"def build():",
					"    class Candidate:",
					"        run = execute",
					"    return Candidate",
				].join("\n"),
				"shadow_method_helper.py": "def execute():\n    return 1\n",
				"shadow_method_service.py": [
					"from .shadow_method_helper import execute",
					"class Service:",
					"    def execute(self): return 2",
					"    run = execute",
				].join("\n"),
				"shadow_field_helper.py": "def execute():\n    return 1\n",
				"shadow_field_service.py": [
					"from .shadow_field_helper import execute",
					"class Service:",
					"    execute = 2",
					"    run = execute",
				].join("\n"),
				"multiple_helper.py": "def execute():\n    return 1\n",
				"first_python_service.py": "from .multiple_helper import execute\nclass First:\n    run = execute\n",
				"second_python_service.py": "from .multiple_helper import execute\nclass Second:\n    run = execute\n",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const locations = violations
			.filter((violation) => violation.rule_id() === "class-field-import")
			.map((violation) => ({ file: violation.file(), line: violation.line() }))
			.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line);

		expect(locations).toEqual([
			{ file: "first_python_service.py", line: 3 },
			{ file: "nested_python_service.py", line: 5 },
			{ file: "second_python_service.py", line: 3 },
		]);
	});
});
