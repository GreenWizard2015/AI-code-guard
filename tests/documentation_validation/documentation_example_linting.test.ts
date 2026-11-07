import { describe, expect, test } from "@jest/globals";
import { CliDocumentationValidation } from "documentation_validation/cli_documentation_validation";
import { ExampleKind } from "documentation_validation/types";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { DocumentationValidationSession } from "src/core/support/documentation_validation_session";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { PYTHON_RULE_EXAMPLES, TYPESCRIPT_RULE_EXAMPLES } from "tests/documentation_validation/constants";
import { DocumentationExampleExecutorProbe } from "tests/documentation_validation/documentation_example_executor_probe";
import { DocumentationProjectFixture } from "tests/documentation_validation/documentation_project_fixture";

describe("documentation example linting with real analyzers", () => {
	test("accepts target violations in bad examples and clean good examples in both languages", async () => {
		const fixture = new DocumentationProjectFixture();
		const project = fixture.create(
			"documentation-validation-",
			new Map(
				Object.entries({
					"docs/rules/typescript/empty-error-handler.md": TYPESCRIPT_RULE_EXAMPLES,
					"docs/rules/python/empty-error-handler.md": PYTHON_RULE_EXAMPLES,
				}),
			),
		);
		const executor = new DocumentationExampleExecutorProbe({ stdout: "ready\n", exit_code: 0 });
		const configuration = new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd()));
		const lint_runner = new DocumentationValidationSession(configuration, configuration);
		const validator = new CliDocumentationValidation(
			project._root,
			lint_runner.rule_ids(),
			lint_runner,
			executor,
			project._source_io,
		);
		const validation = await lint_runner.with_worker(async () => validator.validate(["empty-error-handler"]));
		const good_results = validation.results
			.filter(({ example }) => example.kind === ExampleKind.GOOD)
			.map(({ example, violations }) => [
				example.language,
				violations.map((violation) => [violation.rule_id(), violation.file(), violation.line()]),
			]);
		const all_results = validation.results.map(({ example, passed }) => [example.kind, example.language, passed]);

		expect({ good_results, all_results, document_statuses: validation.document_statuses }).toEqual({
			good_results: [
				["ts", []],
				["py", []],
			],
			all_results: [
				["Bad", "ts", true],
				["Good", "ts", true],
				["Bad", "py", true],
				["Good", "py", true],
			],
			document_statuses: [
				{ file_name: "docs/rules/typescript/empty-error-handler.md", passed: true },
				{ file_name: "docs/rules/python/empty-error-handler.md", passed: true },
			],
		});
	});

	test("reports targeted diagnostics for bad examples and no unrelated rule noise", async () => {
		const fixture = new DocumentationProjectFixture();
		const project = fixture.create(
			"documentation-target-diagnostics-",
			new Map(
				Object.entries({
					"docs/rules/typescript/empty-error-handler.md": TYPESCRIPT_RULE_EXAMPLES,
					"docs/rules/python/empty-error-handler.md": PYTHON_RULE_EXAMPLES,
				}),
			),
		);
		const executor = new DocumentationExampleExecutorProbe({ stdout: "ready\n", exit_code: 0 });
		const configuration = new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd()));
		const lint_runner = new DocumentationValidationSession(configuration, configuration);
		const validator = new CliDocumentationValidation(
			project._root,
			lint_runner.rule_ids(),
			lint_runner,
			executor,
			project._source_io,
		);
		const results = await lint_runner.with_worker(async () => validator.validate(["empty-error-handler"]).results);
		const target_diagnostics = results.map(({ example, violations }) => {
			if (example.kind === ExampleKind.BAD) {
				return violations.some((violation) => violation.rule_id() === "empty-error-handler");
			}
			return violations.length === 0;
		});
		const unrelated_diagnostics = results
			.filter(({ example }) => !example.rule_id.startsWith("responsibilities"))
			.flatMap(({ violations }) => violations)
			.filter((violation) => violation.rule_id().startsWith("responsibilities"));

		expect({ target_diagnostics, unrelated_diagnostics }).toEqual({
			target_diagnostics: [true, true, true, true],
			unrelated_diagnostics: [],
		});
	});

	test("lints TypeScript and Python virtual sources and retains unresolved-import diagnostics", async () => {
		const typescript_root = "/virtual/ai-code-guard-virtual-typescript";
		const python_root = "/virtual/ai-code-guard-virtual-python";
		const configuration = new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd()));
		const lint_runner = new DocumentationValidationSession(configuration, configuration);
		const result = await lint_runner.with_worker(() =>
			Promise.resolve().then(() => {
				const typescript_violations = lint_runner.lint(typescript_root, "src/service.ts", "missing-import", [
					{ path: "src/service.ts", text: "import { Item } from './deleted';\nexport { Item };\n" },
					{ path: "src/other.ts", text: "export class Other {}\n" },
				]);
				const python_violations = lint_runner.lint(python_root, "src/cli.py", "empty-error-handler", [
					{
						path: "src/cli.py",
						text: "if __name__ == '__main__':\n    try:\n        work()\n    except OSError:\n        pass\n",
					},
				]);
				return { typescript_violations, python_violations };
			}),
		);

		expect({
			missing_import: result.typescript_violations.some((violation) => violation.rule_id() === "missing-import"),
			python_rule: result.python_violations.some((violation) => violation.rule_id() === "empty-error-handler"),
		}).toEqual({ missing_import: true, python_rule: true });
	});
});
