import { describe, expect, test } from "@jest/globals";
import { CliDocumentationValidation } from "documentation_validation/cli_documentation_validation";
import { DocumentationExamplePathLayout } from "documentation_validation/examples/documentation_example_path_layout";
import { DocumentationExamplePathValidation } from "documentation_validation/examples/documentation_example_path_validation";
import { RuleDocumentationCatalog } from "documentation_validation/rule_documentation_catalog";
import { DocumentationLanguage, ExampleKind } from "documentation_validation/types";
import type {
	CallableDocumentationValidationOperation,
	DocumentationExample,
	DocumentationExampleLintContract,
} from "documentation_validation/types";
import { ViolationValue } from "src/model/violation_value";
import { CLI_FILE_ORDER_EXAMPLES, MULTI_FILE_MARKDOWN_EXAMPLE } from "tests/documentation_validation/constants";
import { DocumentationExampleExecutorProbe } from "tests/documentation_validation/documentation_example_executor_probe";
import { DocumentationProjectFixture } from "tests/documentation_validation/documentation_project_fixture";

describe("documentation example paths", () => {
	test("requires a CLI entrypoint for both language examples", () => {
		const typescript_example = {
			rule_id: "typescript-example",
			language: DocumentationLanguage.TYPESCRIPT,
			kind: ExampleKind.GOOD,
			index: 0,
			text: "const value = true;",
			source_files: [{ path: "src/example.ts", text: "const value = true;" }],
		};
		const python_example = {
			rule_id: "python-example",
			language: DocumentationLanguage.PYTHON,
			kind: ExampleKind.GOOD,
			index: 0,
			text: "value = True",
			source_files: [{ path: "src/example.py", text: "value = True" }],
		};
		const typescript_validation = new DocumentationExamplePathValidation(typescript_example);
		const python_validation = new DocumentationExamplePathValidation(python_example);

		expect({
			typescript: typescript_validation.cli_order_issues(),
			python: python_validation.cli_order_issues(),
		}).toEqual({
			typescript: ["cli.ts must be declared as the final File: entry"],
			python: ["cli.py must be declared as the final File: entry"],
		});
	});

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

		const typescript_paths = new DocumentationExamplePathLayout(typescript_example);
		const python_paths = new DocumentationExamplePathLayout(python_example);
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

		const typescript_paths = new DocumentationExamplePathLayout(typescript_example);
		const python_paths = new DocumentationExamplePathLayout(python_example);
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
		const executor = new DocumentationExampleExecutorProbe({ stdout: "ready\n", exit_code: 0 });
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
			with_worker: async <T>(operation: CallableDocumentationValidationOperation<T>): Promise<T> => await operation(),
		};
		const validator = new CliDocumentationValidation(
			fixture._root,
			["cli-order"],
			lint_runner,
			executor,
			fixture._source_io,
		);
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
			fixture._root,
			["typescript-multi-file-example"],
			fixture._source_io,
		);
		const catalog = documentation_catalog.describe_rule("typescript-multi-file-example");
		const good_examples = catalog.examples.get(ExampleKind.GOOD);
		const example = (good_examples ?? []).find((candidate) => candidate.language === "ts");
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
			fixture._root,
			["typescript-multi-file-example"],
			fixture._source_io,
		);
		const catalog = documentation_catalog.describe_rule("typescript-multi-file-example");
		let examples: readonly DocumentationExample[] = [];
		const good_examples = catalog.examples.get(ExampleKind.GOOD);
		if (good_examples !== undefined) {
			examples = good_examples;
		}
		const example = examples.find((candidate) => candidate.language === "ts");
		const path_results: DocumentationExamplePathLayout[] = [];
		if (example !== undefined) {
			path_results.push(new DocumentationExamplePathLayout(example));
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

		const duplicate_paths = new DocumentationExamplePathLayout(duplicate);
		const duplicate_validation = new DocumentationExamplePathValidation(duplicate);
		const escaping_paths = new DocumentationExamplePathLayout(escaping);
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
