import { spawnSync } from "node:child_process";
import { describe, expect, test } from "@jest/globals";
import { CliDocumentationValidation } from "documentation_validation/cli_documentation_validation";
import { DocumentationExampleSandbox } from "documentation_validation/sandbox/documentation_example_sandbox";
import type {
	DocumentationExampleExecutorContract,
	DocumentationExampleLintContract,
} from "documentation_validation/types";
import { TYPESCRIPT_TEMPLATE_RUN_MARKDOWN } from "tests/documentation_validation/constants";
import { DocumentationProjectFixture } from "tests/documentation_validation/documentation_project_fixture";

describe("TypeScript documentation template handling", () => {
	const fixture = new DocumentationProjectFixture("/virtual/template-run", {
		"docs/rules/typescript/empty-error-handler.md": TYPESCRIPT_TEMPLATE_RUN_MARKDOWN,
	});

	test("expands templates before linting source files", () => {
		const linted_source_texts: string[] = [];
		const lint_runner: DocumentationExampleLintContract = {
			lint: (_root, _source, _rule, source_files) => {
				linted_source_texts.push(...source_files.map((source_file) => source_file.text));
				return [];
			},
			with_worker: async (operation) => await operation(),
		};
		const executor: DocumentationExampleExecutorContract = {
			capture_output: () => ({ stdout: "first\nsecond\n", exit_code: 0 }),
		};
		const validation_runner = new CliDocumentationValidation(
			fixture._root,
			["empty-error-handler"],
			lint_runner,
			executor,
			fixture._source_io,
		);
		const validation = validation_runner.validate([]);
		const good_results = validation.results.filter(({ example }) => example.kind === "Good");

		expect({
			good_result_count: good_results.length,
			first: linted_source_texts.some((text) => text.includes('console.log("first");')),
			second: linted_source_texts.some((text) => text.includes('console.log("second");')),
			template: linted_source_texts.some((text) => text.includes("{{name}}")),
		}).toEqual({ good_result_count: 1, first: true, second: true, template: false });
	});

	test("expands templates before executing source files", () => {
		const lint_runner: DocumentationExampleLintContract = {
			lint: () => [],
			with_worker: async (operation) => await operation(),
		};
		const executor = new DocumentationExampleSandbox(spawnSync);
		const validation_runner = new CliDocumentationValidation(
			fixture._root,
			["empty-error-handler"],
			lint_runner,
			executor,
			fixture._source_io,
		);
		const validation = validation_runner.validate([]);
		const good_results = validation.results.filter(({ example }) => example.kind === "Good");

		expect({
			passed: good_results.map(({ passed }) => passed),
		}).toEqual({ passed: [true] });
	});
});
