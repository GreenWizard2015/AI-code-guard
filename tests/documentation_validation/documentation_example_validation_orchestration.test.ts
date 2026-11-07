import { describe, expect, test } from "@jest/globals";
import { CliDocumentationValidation } from "documentation_validation/cli_documentation_validation";
import type {
	CallableDocumentationValidationOperation,
	DocumentationExampleLintContract,
} from "documentation_validation/types";
import { ExampleKind } from "documentation_validation/types";
import { ViolationValue } from "src/model/violation_value";
import { DocumentationExampleExecutorProbe } from "tests/documentation_validation/documentation_example_executor_probe";
import { DocumentationProjectFixture } from "tests/documentation_validation/documentation_project_fixture";

describe("documentation example validation orchestration", () => {
	test("accepts long examples without imposing a line limit", () => {
		const example_lines = [
			"# typescript-long-example",
			"## Bad",
			"```ts",
			"// File: src/example.ts",
			Array.from({ length: 15 }, (_, index) => `const item_${index} = ${index};`).join("\n"),
			"// File: cli.ts",
			"void 0;",
			"```",
			"```ts",
			"// File: src/example.ts",
			Array.from({ length: 16 }, (_, index) => `const item_${index} = ${index};`).join("\n"),
			"// File: cli.ts",
			"void 0;",
			"```",
			"## Good",
			"```ts",
			"// File: src/example.ts",
			"const item = 1;",
			"// File: cli.ts",
			"void 0;",
			"```",
		];
		const fixture = new DocumentationProjectFixture();
		const project = fixture.create(
			"documentation-line-limit-",
			new Map([["docs/rules/typescript-long-example.md", example_lines.join("\n")]]),
		);
		const executor = new DocumentationExampleExecutorProbe({ stdout: "ready\n", exit_code: 0 });
		const lint_runner: DocumentationExampleLintContract = {
			lint: (_project_root, source_path, _rule_id, source_files) => {
				const source = source_files.map(({ text }) => text).join("\n");
				if (source.includes("const item_")) {
					return [
						new ViolationValue({
							file: source_path,
							line: 1,
							message: "long example",
							hint: "shorten example",
							rule_id: "typescript-long-example",
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
			["typescript-long-example"],
			lint_runner,
			executor,
			project._source_io,
		);

		expect(validator.validate([]).results.map(({ example, passed }) => [example.kind, passed])).toEqual([
			[ExampleKind.BAD, true],
			[ExampleKind.BAD, true],
			[ExampleKind.GOOD, true],
		]);
	});

	test("lints code written directly in a Markdown example", () => {
		const observed_sources: string[] = [];
		const fixture = new DocumentationProjectFixture();
		const examples = [
			"## Bad",
			"```ts",
			"// File: src/example.ts",
			"const before = true;",
			"const target_bad = true;",
			"const after = true;",
			"// File: cli.ts",
			"void 0;",
			"```",
			"## Good",
			"```ts",
			"// File: src/example.ts",
			"const before = true;",
			"const target_good = true;",
			"const after = true;",
			"// File: cli.ts",
			"void 0;",
			"```",
		].join("\n");
		const project = fixture.create(
			"documentation-inline-example-",
			new Map([["docs/rules/typescript-inline-example.md", examples]]),
		);
		const executor = new DocumentationExampleExecutorProbe({ stdout: "ready\n", exit_code: 0 });
		const lint_runner: DocumentationExampleLintContract = {
			lint: (_project_root, source_path, _rule_id, source_files) => {
				const source = source_files
					.filter(({ path }) => path !== "cli.ts")
					.map(({ text }) => text)
					.join("\n");
				observed_sources.push(source);
				if (source.includes("target_bad")) {
					return [
						new ViolationValue({
							file: source_path,
							line: 1,
							message: "bad inline example",
							hint: "fix target example",
							rule_id: "typescript-inline-example",
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
			["typescript-inline-example"],
			lint_runner,
			executor,
			project._source_io,
		);
		const results = validator.validate([]).results.map(({ example, passed }) => [example.kind, passed]);

		expect({ results, observed_sources }).toEqual({
			results: [
				[ExampleKind.BAD, true],
				[ExampleKind.GOOD, true],
			],
			observed_sources: [
				"const before = true;\nconst target_bad = true;\nconst after = true;",
				"const before = true;\nconst target_good = true;\nconst after = true;",
			],
		});
	});

	test("lints code directly from Markdown and preserves source line positions", () => {
		const observed_sources: string[] = [];
		const fixture = new DocumentationProjectFixture();
		const examples = [
			"# typescript-example-error-marker",
			"## Bad",
			"```ts",
			"// File: tests/example/example.test.ts",
			"test('fails on this line', () => { // <- error",
			"\texpect(true).toBe(false);",
			"});",
			"// File: cli.ts",
			"void 0;",
			"```",
			"## Good",
			"```ts",
			"// File: src/example.ts",
			"const value = true;",
			"// File: cli.ts",
			"void 0;",
			"```",
		].join("\n");
		const project = fixture.create(
			"documentation-error-marker-",
			new Map([["docs/rules/typescript-example-error-marker.md", examples]]),
		);
		const executor = new DocumentationExampleExecutorProbe({ stdout: "ready\n", exit_code: 0 });
		const lint_runner: DocumentationExampleLintContract = {
			lint: (_project_root, source_path, _rule_id, source_files) => {
				const source = source_files
					.filter(({ path }) => path !== "cli.ts")
					.map(({ text }) => text)
					.join("\n");
				observed_sources.push(source);
				if (source.includes("fails on this line")) {
					return [
						new ViolationValue({
							file: source_path,
							line: 1,
							message: "marked source line",
							hint: "remove marker before linting",
							rule_id: "typescript-example-error-marker",
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
			["typescript-example-error-marker"],
			lint_runner,
			executor,
			project._source_io,
		);
		const results = validator.validate([]).results.map(({ example, passed }) => [example.kind, passed]);

		expect({ results, observed_sources }).toEqual({
			results: [
				[ExampleKind.BAD, true],
				[ExampleKind.GOOD, true],
			],
			observed_sources: [
				"test('fails on this line', () => {            \n\texpect(true).toBe(false);\n});",
				"const value = true;",
			],
		});
	});
});
