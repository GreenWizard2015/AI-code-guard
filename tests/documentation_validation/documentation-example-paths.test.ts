import { describe, expect, test } from "@jest/globals";
import { DocumentationExamplePath } from "documentation_validation/documentation_example_path";
import { DocumentationExamplePathValidation } from "documentation_validation/documentation_example_path_validation";
import { CliDocumentationValidation } from "documentation_validation/cli_documentation_validation";
import { RuleDocumentationCatalog } from "documentation_validation/rule_documentation_catalog";
import { DocumentationLanguage, ExampleKind } from "documentation_validation/types";
import type {
	DocumentationExample,
	DocumentationExampleLintContract,
	DocumentationValidationOperation,
} from "documentation_validation/types";
import { DocumentationProjectFixture } from "tests/documentation_validation/documentation_project_fixture";
import { CLI_FILE_ORDER_EXAMPLES, MULTI_FILE_MARKDOWN_EXAMPLE } from "tests/documentation_validation/constants";
import { ViolationValue } from "src/violation_value";

describe("documentation example paths", () => {
	test("places recognizable test examples under the tests directory", () => {
		const typescript_example = {
			rule_id: "typescript-example",
			language: DocumentationLanguage.TYPESCRIPT,
			kind: ExampleKind.BAD,
			index: 0,
			text: "test('reads value', () => {});",
			source_files: [],
		};
		const python_example = {
			rule_id: "python-example",
			language: DocumentationLanguage.PYTHON,
			kind: ExampleKind.BAD,
			index: 0,
			text: "class TestValue(unittest.TestCase):",
			source_files: [],
		};

		const typescript_paths = new DocumentationExamplePath(typescript_example);
		const python_paths = new DocumentationExamplePath(python_example);
		expect({
			typescript: typescript_paths.analysis_path(),
			python: python_paths.analysis_path(),
		}).toEqual({
			typescript: "tests/documentation/typescript-example/example.test.ts",
			python: "tests/documentation/python-example/example_test.py",
		});
	});

	test("analyzes explicitly marked test files at invalid project paths", () => {
		const typescript_example = {
			rule_id: "typescript-example",
			language: DocumentationLanguage.TYPESCRIPT,
			kind: ExampleKind.BAD,
			index: 0,
			text: "test('invalid location', () => {});",
			source_files: [{ path: "src/domain/service.test.ts", text: "test('invalid location', () => {});" }],
		};
		const python_example = {
			rule_id: "python-example",
			language: DocumentationLanguage.PYTHON,
			kind: ExampleKind.BAD,
			index: 0,
			text: "def test_invalid_location(): pass",
			source_files: [{ path: "src/domain/test_service.py", text: "def test_invalid_location(): pass" }],
		};

		const typescript_paths = new DocumentationExamplePath(typescript_example);
		const python_paths = new DocumentationExamplePath(python_example);
		expect({
			typescript: typescript_paths.analysis_path(),
			python: python_paths.analysis_path(),
		}).toEqual({
			typescript: "src/domain/service.test.ts",
			python: "src/domain/test_service.py",
		});
	});

	test("requires cli files to be the last marked file in every language block", () => {
		const fixture = new DocumentationProjectFixture("/virtual/cli-order", {
			"docs/rules/cli-order.md": CLI_FILE_ORDER_EXAMPLES,
		});
		const lint_runner: DocumentationExampleLintContract = {
			lint: (_project_root, source_path, _rule_id, source_files) => {
				if (source_files.some(({ text }) => text.includes("target_bad"))) {
					return [
						new ViolationValue({
							file: source_path,
							line: 1,
							message: "invalid cli file order",
							hint: "move cli to the end",
							rule_id: "cli-order",
							priority: 1,
						}),
					];
				}
				return [];
			},
			with_worker: <T>(operation: DocumentationValidationOperation<T>): T => operation(),
		};
		const validator = new CliDocumentationValidation(fixture.root, ["cli-order"], lint_runner, fixture.source_io);
		const results = validator
			.validate([])
			.results.map(({ example, structural_errors, passed }) => [
				example.kind,
				example.language,
				structural_errors,
				passed,
			]);

		expect(results).toEqual([
			[
				ExampleKind.BAD,
				DocumentationLanguage.TYPESCRIPT,
				["cli.ts must be the last File: entry in its Markdown block"],
				false,
			],
			[
				ExampleKind.BAD,
				DocumentationLanguage.PYTHON,
				["cli.py must be the last File: entry in its Markdown block"],
				false,
			],
			[ExampleKind.GOOD, DocumentationLanguage.TYPESCRIPT, [], true],
			[ExampleKind.GOOD, DocumentationLanguage.PYTHON, [], true],
		]);
	});

	test("keeps all marked files in one documentation example", () => {
		const fixture = new DocumentationProjectFixture("/virtual/multi-file-example", {
			"docs/rules/typescript-multi-file-example.md": MULTI_FILE_MARKDOWN_EXAMPLE,
		});
		const documentation_catalog = new RuleDocumentationCatalog(
			fixture.root,
			["typescript-multi-file-example"],
			fixture.source_io,
		);
		const catalog = documentation_catalog.describe_rule("typescript-multi-file-example");
		const good_examples = catalog.examples.get(ExampleKind.GOOD);
		const example = good_examples?.find((candidate) => candidate.language === "ts");
		let files: string[] = [];
		if (example !== undefined) {
			files = example.source_files.map((source_file) => source_file.path);
		}
		expect(files).toEqual(["cli.ts", "src/domain/status.ts", "tests/domain/status.test.ts"]);
	});

	test("selects production, test, and analysis paths from marked files", () => {
		const fixture = new DocumentationProjectFixture("/virtual/multi-file-paths", {
			"docs/rules/typescript-multi-file-example.md": MULTI_FILE_MARKDOWN_EXAMPLE,
		});
		const documentation_catalog = new RuleDocumentationCatalog(
			fixture.root,
			["typescript-multi-file-example"],
			fixture.source_io,
		);
		const catalog = documentation_catalog.describe_rule("typescript-multi-file-example");
		let examples: readonly DocumentationExample[] = [];
		const good_examples = catalog.examples.get(ExampleKind.GOOD);
		if (good_examples !== undefined) {
			examples = good_examples;
		}
		const example = examples.find((candidate) => candidate.language === "ts");
		const path_results: DocumentationExamplePath[] = [];
		if (example !== undefined) {
			path_results.push(new DocumentationExamplePath(example));
		}
		expect(
			path_results.map((paths) => ({
				source: paths.source_path(),
				test: paths.test_path(),
				analysis: paths.analysis_path(),
			})),
		).toEqual([
			{
				source: "src/domain/status.ts",
				test: "tests/domain/status.test.ts",
				analysis: "tests/domain/status.test.ts",
			},
		]);
	});

	test("rejects duplicate and escaping virtual source paths", () => {
		const duplicate: DocumentationExample = {
			rule_id: "virtual-paths",
			language: DocumentationLanguage.TYPESCRIPT,
			kind: ExampleKind.BAD,
			index: 0,
			text: "",
			source_files: [
				{ path: "src/service.ts", text: "class Service {}" },
				{ path: "src/service.ts", text: "class Replacement {}" },
			],
		};
		const escaping: DocumentationExample = {
			rule_id: "virtual-paths",
			language: DocumentationLanguage.TYPESCRIPT,
			kind: ExampleKind.BAD,
			index: 1,
			text: "",
			source_files: [{ path: "../outside.ts", text: "class Outside {}" }],
		};

		const duplicate_paths = new DocumentationExamplePath(duplicate);
		const duplicate_validation = new DocumentationExamplePathValidation(duplicate);
		const escaping_paths = new DocumentationExamplePath(escaping);
		const escaping_validation = new DocumentationExamplePathValidation(escaping);
		expect({
			duplicate: duplicate_validation.source_path_issues(duplicate_paths.analysis_path()),
			escaping: escaping_validation.source_path_issues(escaping_paths.analysis_path()),
		}).toEqual({
			duplicate: ["src/service.ts is declared more than once in this Markdown block"],
			escaping: ["../outside.ts must be a relative path inside the example project"],
		});
	});
});
