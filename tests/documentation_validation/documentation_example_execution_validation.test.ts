import { describe, expect, test } from "@jest/globals";
import { CliDocumentationValidation } from "documentation_validation/cli_documentation_validation";
import { DocumentationExampleEvaluation } from "documentation_validation/documentation_example_evaluation";
import { RuleDocumentationCatalog } from "documentation_validation/rule_documentation_catalog";
import { ExampleKind } from "documentation_validation/types";
import type {
	CallableDocumentationValidationOperation,
	DocumentationExampleLintContract,
} from "documentation_validation/types";
import { ViolationValue } from "src/model/violation_value";
import {
	DOCUMENTATION_EXAMPLE_FALLBACK,
	DOCUMENTATION_EXECUTION_TEST_MARKDOWN,
} from "tests/documentation_validation/constants";
import { DocumentationExampleExecutorProbe } from "tests/documentation_validation/documentation_example_executor_probe";
import { DocumentationProjectFixture } from "tests/documentation_validation/documentation_project_fixture";

describe("documentation example execution validation", () => {
	test("accepts non-empty output from an imported module without an output block", () => {
		const fixture = new DocumentationProjectFixture("/virtual/example-output", {
			"docs/rules/example-rule.md": DOCUMENTATION_EXECUTION_TEST_MARKDOWN,
		});
		const catalog = new RuleDocumentationCatalog(fixture._root, ["example-rule"], fixture._source_io);
		const documentation = catalog.describe_rule("example-rule");
		const examples = documentation.examples.get(ExampleKind.GOOD) ?? [];
		let example = DOCUMENTATION_EXAMPLE_FALLBACK;
		const first_example = examples.find((candidate) => candidate.index === 0);
		if (first_example !== undefined) {
			example = first_example;
		}
		const executor = new DocumentationExampleExecutorProbe({ stdout: "ready\n", exit_code: 0 });
		const lint_runner: DocumentationExampleLintContract = {
			lint: () => [],
			with_worker: async (operation) => await operation(),
		};

		const evaluation = new DocumentationExampleEvaluation(example, lint_runner, executor);
		const result = evaluation.language_result();

		expect({ passed: result.passed, errors: result.structural_errors, executions: executor.calls() }).toEqual({
			passed: true,
			errors: [],
			executions: 1,
		});
	});

	test("rejects a successful run with empty output", () => {
		const fixture = new DocumentationProjectFixture("/virtual/example-output", {
			"docs/rules/example-rule.md": DOCUMENTATION_EXECUTION_TEST_MARKDOWN,
		});
		const catalog = new RuleDocumentationCatalog(fixture._root, ["example-rule"], fixture._source_io);
		const documentation = catalog.describe_rule("example-rule");
		const examples = documentation.examples.get(ExampleKind.GOOD) ?? [];
		let example = DOCUMENTATION_EXAMPLE_FALLBACK;
		const first_example = examples.find((candidate) => candidate.index === 0);
		if (first_example !== undefined) {
			example = first_example;
		}
		const executor = new DocumentationExampleExecutorProbe({ stdout: "", exit_code: 0 });
		const lint_runner: DocumentationExampleLintContract = {
			lint: () => [],
			with_worker: async (operation) => await operation(),
		};
		const evaluation = new DocumentationExampleEvaluation(example, lint_runner, executor);
		const result = evaluation.language_result();

		expect(result.structural_errors).toEqual(["cli.ts produced no output"]);
	});

	test("rejects nonzero exit codes and includes captured output", () => {
		const fixture = new DocumentationProjectFixture("/virtual/example-output", {
			"docs/rules/example-rule.md": DOCUMENTATION_EXECUTION_TEST_MARKDOWN,
		});
		const catalog = new RuleDocumentationCatalog(fixture._root, ["example-rule"], fixture._source_io);
		const documentation = catalog.describe_rule("example-rule");
		const examples = documentation.examples.get(ExampleKind.GOOD) ?? [];
		let example = DOCUMENTATION_EXAMPLE_FALLBACK;
		const first_example = examples.find((candidate) => candidate.index === 0);
		if (first_example !== undefined) {
			example = first_example;
		}
		const executor = new DocumentationExampleExecutorProbe({ stdout: "different\n", exit_code: 2 });
		const lint_runner: DocumentationExampleLintContract = {
			lint: () => [],
			with_worker: async (operation) => await operation(),
		};
		const evaluation = new DocumentationExampleEvaluation(example, lint_runner, executor);
		const result = evaluation.language_result();

		expect(result.structural_errors).toEqual(["cli.ts exited with code 2", "different\n"]);
	});

	test("filters configured diagnostics from simulated example lint results", () => {
		const fixture = new DocumentationProjectFixture();
		const project = fixture.create(
			"documentation-excluded-size-rule-",
			new Map(
				Object.entries({
					"docs/rules/typescript/file-min-size.md": [
						"# file-min-size",
						"## Bad",
						"```ts",
						"// File: src/value.ts",
						"const value = 1;",
						"// File: cli.ts",
						"void 0;",
						"```",
						"## Good",
						"```ts",
						"// File: src/value.ts",
						"const value = 1;",
						"// File: cli.ts",
						"void 0;",
						"```",
					].join("\n"),
					"docs/rules/python/file-min-size.md": [
						"# file-min-size",
						"## Bad",
						"```py",
						"# File: src/value.py",
						"value = 1",
						"# File: cli.py",
						"pass",
						"```",
						"## Good",
						"```py",
						"# File: src/value.py",
						"value = 1",
						"# File: cli.py",
						"pass",
						"```",
					].join("\n"),
				}),
			),
		);
		const executor = new DocumentationExampleExecutorProbe({ stdout: "ready\n", exit_code: 0 });
		const lint_runner: DocumentationExampleLintContract = {
			lint: (_project_root, source_path) => [
				new ViolationValue({
					file: source_path,
					line: 1,
					message: "file too small",
					hint: "add required content",
					rule_id: "file-min-size",
					priority: 1,
				}),
			],
			with_worker: async <T>(operation: CallableDocumentationValidationOperation<T>): Promise<T> => await operation(),
		};
		const validator = new CliDocumentationValidation(
			project._root,
			["file-min-size"],
			lint_runner,
			executor,
			project._source_io,
		);
		const results = validator
			.validate([])
			.results.map(({ example, passed }) => [example.kind, example.language, passed]);

		expect(results).toEqual([
			[ExampleKind.BAD, "ts", true],
			[ExampleKind.GOOD, "ts", true],
			[ExampleKind.BAD, "py", true],
			[ExampleKind.GOOD, "py", true],
		]);
	});
});
