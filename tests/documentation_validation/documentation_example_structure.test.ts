import { describe, expect, test } from "@jest/globals";
import { CliDocumentationValidation } from "#documentation_validation/cli_documentation_validation";
import { ViolationValue } from "src/violation_value";
import { DocumentationProjectFixture } from "tests/documentation_validation/documentation_project_fixture";
import type {
	DocumentationExampleLintContract,
	DocumentationValidationOperation,
} from "#documentation_validation/types";

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
		const lint_runner: DocumentationExampleLintContract = {
			lint: () => {
				lint_calls += 1;
				return [];
			},
			with_worker: <T>(operation: DocumentationValidationOperation<T>): T => operation(),
		};
		const validator = new CliDocumentationValidation(
			project.root,
			["directory-class-min-size", "directory-class-max-size"],
			lint_runner,
			project.source_io,
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
						'test("bad_case", () => {});',
						"```",
						"## Good",
						"```ts",
						"// File: src/example.ts",
						"const broken = ;",
						"// File: src/./example.ts",
						"const valid = true;",
						"```",
					].join("\n"),
				}),
			),
		);
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
			with_worker: <T>(operation: DocumentationValidationOperation<T>): T => operation(),
		};
		const validator = new CliDocumentationValidation(
			project.root,
			["typescript-jest-test-ending"],
			lint_runner,
			project.source_io,
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
});
