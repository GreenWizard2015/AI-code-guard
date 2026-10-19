import { describe, expect, test } from "@jest/globals";
import { CliDocumentationValidation } from "documentation_validation/cli_documentation_validation";
import type {
	DocumentationExampleLintContract,
	DocumentationValidationOperation,
} from "documentation_validation/types";
import { DocumentationValidationSession } from "src/core/support/documentation_validation_session";
import { ExampleKind } from "documentation_validation/types";
import { ViolationValue } from "src/violation_value";
import { PYTHON_RULE_EXAMPLES, TYPESCRIPT_RULE_EXAMPLES } from "tests/documentation_validation/constants";
import { DocumentationProjectFixture } from "tests/documentation_validation/documentation_project_fixture";

describe("documentation example linting", () => {
	test("accepts target violations in bad examples and clean good examples in both languages", () => {
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
		const lint_runner = new DocumentationValidationSession();
		const validator = new CliDocumentationValidation(
			project.root,
			lint_runner.rule_ids(),
			lint_runner,
			project.source_io,
		);
		const validation = lint_runner.with_worker(() => validator.validate(["empty-error-handler"]));
		const good_results = validation.results
			.filter(({ example }) => example.kind === ExampleKind.GOOD)
			.map(({ example, violations }) => [
				example.language,
				violations.map(({ rule_id, file, line }) => [rule_id, file, line]),
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

	test("reports the targeted diagnostic for bad examples and no unrelated rule noise", () => {
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
		const lint_runner = new DocumentationValidationSession();
		const validator = new CliDocumentationValidation(
			project.root,
			lint_runner.rule_ids(),
			lint_runner,
			project.source_io,
		);
		const results = lint_runner.with_worker(() => validator.validate(["empty-error-handler"]).results);
		const target_diagnostics = results.map(({ example, violations }) => {
			if (example.kind === ExampleKind.BAD) {
				return violations.some((violation) => violation.rule_id === "empty-error-handler");
			}
			return violations.length === 0;
		});
		const unrelated_diagnostics = results
			.filter(({ example }) => !example.rule_id.startsWith("responsibilities"))
			.flatMap(({ violations }) => violations)
			.filter(({ rule_id }) => rule_id.startsWith("responsibilities"));

		expect({ target_diagnostics, unrelated_diagnostics }).toEqual({
			target_diagnostics: [true, true, true, true],
			unrelated_diagnostics: [],
		});
	});

	test("does not require excluded size-rule diagnostics in bad examples", () => {
		const fixture = new DocumentationProjectFixture();
		const project = fixture.create(
			"documentation-excluded-size-rule-",
			new Map(
				Object.entries({
					"docs/rules/typescript/file-min-size.md": [
						"# file-min-size",
						"## Bad",
						"```ts",
						"const value = 1;",
						"```",
						"## Good",
						"```ts",
						"const value = 1;",
						"```",
					].join("\n"),
					"docs/rules/python/file-min-size.md": [
						"# file-min-size",
						"## Bad",
						"```py",
						"value = 1",
						"```",
						"## Good",
						"```py",
						"value = 1",
						"```",
					].join("\n"),
				}),
			),
		);
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
			with_worker: <T>(operation: DocumentationValidationOperation<T>): T => operation(),
		};
		const validator = new CliDocumentationValidation(project.root, ["file-min-size"], lint_runner, project.source_io);
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
