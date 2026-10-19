import { describe, expect, test } from "@jest/globals";
import { resolve } from "node:path";
import { CliDocumentationValidation } from "documentation_validation/cli_documentation_validation";
import type {
	DocumentationExampleLintContract,
	DocumentationValidationOperation,
} from "documentation_validation/types";
import { DocumentationValidationSession } from "src/core/support/documentation_validation_session";
import { ExampleKind } from "documentation_validation/types";
import { ViolationValue } from "src/violation_value";
import { DocumentationProjectFixture } from "tests/documentation_validation/documentation_project_fixture";

describe("virtual source linting for documentation", () => {
	test("includes project-wide unresolved-import diagnostics", () => {
		const root = resolve("/virtual/documentation-global-import-diagnostic");
		const lint_runner = new DocumentationValidationSession();
		const violations = lint_runner.with_worker(() =>
			lint_runner.lint(root, "src/service.ts", "missing-import", [
				{ path: "src/service.ts", text: "import { Item } from './deleted';\nexport { Item };\n" },
			]),
		);

		expect(violations.map(({ rule_id }) => rule_id)).toContain("missing-import");
	});

	test("lints virtual TypeScript and Python without making a project directory", () => {
		const typescript_root = resolve("/virtual/ai-code-guard-virtual-typescript");
		const python_root = resolve("/virtual/ai-code-guard-virtual-python");
		const lint_runner = new DocumentationValidationSession();
		const result = lint_runner.with_worker(() => {
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
		});

		expect({
			missing_import: result.typescript_violations.some(({ rule_id }) => rule_id === "missing-import"),
			python_rule: result.python_violations.some(({ rule_id }) => rule_id === "empty-error-handler"),
		}).toEqual({ missing_import: true, python_rule: true });
	});

	test("accepts long examples without imposing a line limit", () => {
		const example_lines = [
			"# typescript-long-example",
			"## Bad",
			"```ts",
			Array.from({ length: 15 }, (_, index) => `const item_${index} = ${index};`).join("\n"),
			"```",
			"```ts",
			Array.from({ length: 16 }, (_, index) => `const item_${index} = ${index};`).join("\n"),
			"```",
			"## Good",
			"```ts",
			"const item = 1;",
			"```",
		];
		const fixture = new DocumentationProjectFixture();
		const project = fixture.create(
			"documentation-line-limit-",
			new Map([["docs/rules/typescript-long-example.md", example_lines.join("\n")]]),
		);
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
			with_worker: <T>(operation: DocumentationValidationOperation<T>): T => operation(),
		};
		const validator = new CliDocumentationValidation(
			project.root,
			["typescript-long-example"],
			lint_runner,
			project.source_io,
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
			"const before = true;",
			"const target_bad = true;",
			"const after = true;",
			"```",
			"## Good",
			"```ts",
			"const before = true;",
			"const target_good = true;",
			"const after = true;",
			"```",
		].join("\n");
		const project = fixture.create(
			"documentation-inline-example-",
			new Map([["docs/rules/typescript-inline-example.md", examples]]),
		);
		const lint_runner: DocumentationExampleLintContract = {
			lint: (_project_root, source_path, _rule_id, source_files) => {
				const source = source_files.map(({ text }) => text).join("\n");
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
			with_worker: <T>(operation: DocumentationValidationOperation<T>): T => operation(),
		};
		const validator = new CliDocumentationValidation(
			project.root,
			["typescript-inline-example"],
			lint_runner,
			project.source_io,
		);
		const results = validator.validate([]).results.map(({ example, passed }) => [example.kind, passed]);

		expect({ results, observed_sources }).toEqual({
			results: [
				[ExampleKind.BAD, true],
				[ExampleKind.GOOD, true],
			],
			observed_sources: [
				"const before = true;\nconst target_bad = true;\nconst after = true;\n",
				"const before = true;\nconst target_good = true;\nconst after = true;\n",
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
			"```",
			"## Good",
			"```ts",
			"const value = true;",
			"```",
		].join("\n");
		const project = fixture.create(
			"documentation-error-marker-",
			new Map([["docs/rules/typescript-example-error-marker.md", examples]]),
		);
		const lint_runner: DocumentationExampleLintContract = {
			lint: (_project_root, source_path, _rule_id, source_files) => {
				const source = source_files.map(({ text }) => text).join("\n");
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
			with_worker: <T>(operation: DocumentationValidationOperation<T>): T => operation(),
		};
		const validator = new CliDocumentationValidation(
			project.root,
			["typescript-example-error-marker"],
			lint_runner,
			project.source_io,
		);
		const results = validator.validate([]).results.map(({ example, passed }) => [example.kind, passed]);

		expect({ results, observed_sources }).toEqual({
			results: [
				[ExampleKind.BAD, true],
				[ExampleKind.GOOD, true],
			],
			observed_sources: [
				"test('fails on this line', () => {            \n\texpect(true).toBe(false);\n});\n",
				"const value = true;\n",
			],
		});
	});
});
