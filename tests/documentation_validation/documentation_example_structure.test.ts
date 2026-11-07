import { describe, expect, test } from "@jest/globals";
import { CliDocumentationValidation } from "documentation_validation/cli_documentation_validation";
import { DocumentationLanguage, ExampleKind } from "documentation_validation/types";
import type {
	CallableDocumentationValidationOperation,
	DocumentationExampleLintContract,
} from "documentation_validation/types";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { DocumentationValidationSession } from "src/core/support/documentation_validation_session";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { ViolationValue } from "src/model/violation_value";
import { DocumentationExampleExecutorProbe } from "tests/documentation_validation/documentation_example_executor_probe";
import { DocumentationProjectFixture } from "tests/documentation_validation/documentation_project_fixture";

describe("documentation example structure", () => {
	test("requires bad and good sections without validating directory diagram contents", () => {
		const fixture = new DocumentationProjectFixture();
		const project = fixture.create(
			"directory-class-structure-examples",
			new Map(
				Object.entries({
					"docs/rules/directory-class-min-size.md": [
						"# directory-class-min-size",
						"## Bad",
						"```text",
						"an illustrative tree with arbitrary labels",
						"```",
						"## Good",
						"```text",
						"a different illustrative tree",
						"```",
					].join("\n"),
					"docs/rules/directory-class-max-size.md": [
						"# directory-class-max-size",
						"## Bad",
						"```text",
						"an illustrative tree with arbitrary labels",
						"```",
						"## Good",
						"```text",
						"a different illustrative tree",
						"```",
					].join("\n"),
				}),
			),
		);
		let lint_calls = 0;
		const executor = new DocumentationExampleExecutorProbe({ stdout: "", exit_code: 0 });
		const lint_runner: DocumentationExampleLintContract = {
			lint: () => {
				lint_calls += 1;
				return [];
			},
			with_worker: async <T>(operation: CallableDocumentationValidationOperation<T>): Promise<T> => await operation(),
		};
		const validator = new CliDocumentationValidation(
			project._root,
			["directory-class-min-size", "directory-class-max-size"],
			lint_runner,
			executor,
			project._source_io,
		);
		const validation = validator.validate([]);

		expect({
			lint_calls,
			results: validation.results.map(({ example, passed }) => [
				example.rule_id,
				example.kind,
				example.language,
				passed,
			]),
			documents: validation.document_statuses.map(({ passed }) => passed),
		}).toEqual({
			lint_calls: 0,
			results: [
				["directory-class-min-size", "Bad", "text", true],
				["directory-class-min-size", "Good", "text", true],
				["directory-class-max-size", "Bad", "text", true],
				["directory-class-max-size", "Good", "text", true],
			],
			documents: [true, true],
		});
	});

	test("rejects normalized duplicate files before linting a good example", () => {
		let lint_calls = 0;
		const fixture = new DocumentationProjectFixture();
		const project = fixture.create(
			"documentation-duplicate-source-",
			new Map(
				Object.entries({
					"docs/rules/typescript/jest-test-ending.md": [
						"# typescript-jest-test-ending",
						"## Bad",
						"```ts",
						"// File: tests/example/example.test.ts",
						'test("bad_case", () => {});',
						"// File: cli.ts",
						"void 0;",
						"```",
						"## Good",
						"```ts",
						"// File: src/example.ts",
						"const broken = ;",
						"// File: src/./example.ts",
						"const valid = true;",
						"// File: cli.ts",
						"void 0;",
						"```",
					].join("\n"),
				}),
			),
		);
		const executor = new DocumentationExampleExecutorProbe({ stdout: "ready\n", exit_code: 0 });
		const lint_runner: DocumentationExampleLintContract = {
			lint: (_project_root, source_path, _rule_id, source_files) => {
				lint_calls += 1;
				if (source_files.some(({ text }) => text.includes("bad_case"))) {
					return [
						new ViolationValue({
							file: source_path,
							line: 1,
							message: "target diagnostic",
							hint: "fix bad example",
							rule_id: "typescript-jest-test-ending",
							priority: 1,
						}),
					];
				}
				return [];
			},
			with_worker: async <T>(operation: CallableDocumentationValidationOperation<T>): Promise<T> => await operation(),
		};
		const validator = new CliDocumentationValidation(
			project._root,
			["typescript-jest-test-ending"],
			lint_runner,
			executor,
			project._source_io,
		);
		const validation = validator.validate(["typescript-jest-test-ending"]);
		const good_results = validation.results
			.filter(({ example }) => example.kind === "Good")
			.map(({ structural_errors, passed }) => ({ structural_errors, passed }));

		expect({ lint_calls, good_results }).toEqual({
			lint_calls: 1,
			good_results: [
				{
					structural_errors: ["src/./example.ts is declared more than once in this Markdown block"],
					passed: false,
				},
			],
		});
	});

	test("checks only Bad and Good sections in root-level rule documents", async () => {
		const fixture = new DocumentationProjectFixture("/virtual/neutral-rule", {
			"docs/rules/ai-code-guard-directory-ignored.md": [
				"# ai-code-guard-directory-ignored",
				"## Bad",
				"```ts",
				"const value = true;",
				"```",
				"## Good",
				"```python",
				"value = True",
				"```",
			].join("\n"),
		});
		const configuration = new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd()));
		const lint_runner = new DocumentationValidationSession(configuration, configuration);
		const validator = new CliDocumentationValidation(
			fixture._root,
			["ai-code-guard-directory-ignored"],
			lint_runner,
			new DocumentationExampleExecutorProbe({ stdout: "", exit_code: 0 }),
			fixture._source_io,
		);
		const validation = await lint_runner.with_worker(async () => validator.validate([]));

		expect({
			results: validation.results.map(({ example, structural_errors, passed }) => [
				example.kind,
				structural_errors,
				passed,
			]),
			documents: validation.document_statuses.map(({ passed }) => passed),
			line_counts: validation.document_line_counts,
		}).toEqual({
			results: [
				[ExampleKind.BAD, [], true],
				[ExampleKind.GOOD, [], true],
			],
			documents: [true],
			line_counts: [
				{ rule_id: "ai-code-guard-directory-ignored", language: DocumentationLanguage.TYPESCRIPT, line_count: 9 },
				{ rule_id: "ai-code-guard-directory-ignored", language: DocumentationLanguage.PYTHON, line_count: 9 },
			],
		});
	});
});
