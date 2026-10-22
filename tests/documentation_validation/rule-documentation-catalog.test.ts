import { describe, expect, test } from "@jest/globals";
import { MarkdownLoopExpander } from "#documentation_validation/markdown_loop_expander";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";
import { DocumentationProjectFixture } from "tests/documentation_validation/documentation_project_fixture";
import { DocumentationLanguage, ExampleKind } from "#documentation_validation/types";
import { RuleDocumentationCatalog } from "#documentation_validation/rule_documentation_catalog";
import { CliDocumentationValidation } from "#documentation_validation/cli_documentation_validation";
import { DocumentationValidationSession } from "src/core/support/documentation_validation_session";

describe("rule documentation catalog", () => {
	test("expands numeric ranges as zero-based iterations", () => {
		const markdown = [
			"```ts",
			"{%for index in range(3) %}",
			"const item_{{index}} = true;",
			"{% endfor %}",
			"```",
		].join("\n");
		const expander = new MarkdownLoopExpander(new BoundaryFailureClassifier());
		const expanded = expander.expand(markdown);

		const item_lines = expanded.split("\n").filter((line) => line.startsWith("const item_"));
		expect(item_lines).toEqual(["const item_0 = true;", "const item_1 = true;", "const item_2 = true;"]);
	});

	test("extracts each documented language and its good and bad examples", () => {
		const fixture = new DocumentationProjectFixture("/virtual/docs", {
			"docs/rules/typescript/empty-error-handler.md": [
				"# empty-error-handler",
				"## Bad",
				"```ts",
				"try {} catch {}",
				"```",
				"## Good",
				"```ts",
				"try {} catch (error) { throw error; }",
				"```",
			].join("\n"),
			"docs/rules/python/empty-error-handler.md": [
				"# empty-error-handler",
				"## Bad",
				"```python",
				"try: pass",
				"except: pass",
				"```",
				"## Good",
				"```python",
				"try: pass",
				"except Exception as error: raise error",
				"```",
			].join("\n"),
		});
		const catalog = new RuleDocumentationCatalog(fixture.root, ["empty-error-handler"], fixture.source_io);
		const inventory = catalog.collect(["empty-error-handler"]);
		const bad_examples = inventory.documents.flatMap((document) => {
			const examples = document.examples.get(ExampleKind.BAD);
			if (examples === undefined) {
				return [];
			}
			return examples;
		});
		const good_examples = inventory.documents.flatMap((document) => {
			const examples = document.examples.get(ExampleKind.GOOD);
			if (examples === undefined) {
				return [];
			}
			return examples;
		});

		const invalid_entries = [...inventory.invalid_entries];
		invalid_entries.sort();
		expect({
			languages: inventory.documents.map((document) => document.languages),
			bad: bad_examples.map((example) => example.language),
			good: good_examples.map((example) => example.language),
		}).toEqual({
			languages: [[DocumentationLanguage.TYPESCRIPT], [DocumentationLanguage.PYTHON]],
			bad: [DocumentationLanguage.TYPESCRIPT, DocumentationLanguage.PYTHON],
			good: [DocumentationLanguage.TYPESCRIPT, DocumentationLanguage.PYTHON],
		});
	});

	test("uses the rule document folder as the language boundary", () => {
		const fixture = new DocumentationProjectFixture("/virtual/docs", {
			"docs/rules/typescript/in-operator.md": "# in-operator\n",
			"docs/rules/python/test-shape.md": "# test-shape\n",
		});
		const catalog = new RuleDocumentationCatalog(
			fixture.root,
			["typescript-in-operator", "python-test-shape"],
			fixture.source_io,
		);
		const typescript_document = catalog.describe_rule("typescript-in-operator");
		const python_document = catalog.describe_rule("python-test-shape");
		expect({
			typescript_path: typescript_document.file_path,
			typescript_languages: typescript_document.languages,
			python_path: python_document.file_path,
			python_languages: python_document.languages,
		}).toEqual({
			typescript_path: "docs/rules/typescript/in-operator.md",
			typescript_languages: [DocumentationLanguage.TYPESCRIPT],
			python_path: "docs/rules/python/test-shape.md",
			python_languages: [DocumentationLanguage.PYTHON],
		});
	});

	test("requires separate shared-rule documents for both languages", () => {
		const fixture = new DocumentationProjectFixture("/virtual/shared-rule", {
			"docs/rules/typescript/empty-error-handler.md": [
				"# empty-error-handler",
				"## Bad",
				"```ts",
				"const bad_example = true;",
				"```",
				"## Good",
				"```ts",
				"const good_example = true;",
				"```",
			].join("\n"),
			"docs/rules/python/empty-error-handler.md": [
				"# empty-error-handler",
				"## Bad",
				"```python",
				"bad_example = True",
				"```",
				"## Good",
				"```python",
				"good_example = True",
				"```",
			].join("\n"),
		});
		const lint_runner = new DocumentationValidationSession();
		const validator = new CliDocumentationValidation(
			fixture.root,
			["empty-error-handler"],
			lint_runner,
			fixture.source_io,
		);
		const validation = lint_runner.with_worker(() => validator.validate([]));
		expect({
			languages: validation.results.map(({ example }) => example.language),
			structural_errors: validation.results.flatMap(({ structural_errors }) => structural_errors),
			ignored_documents: validation.ignored_documents,
		}).toEqual({
			languages: [
				DocumentationLanguage.TYPESCRIPT,
				DocumentationLanguage.TYPESCRIPT,
				DocumentationLanguage.PYTHON,
				DocumentationLanguage.PYTHON,
			],
			structural_errors: [],
			ignored_documents: 0,
		});
	});

	test("collects only present shared-rule documents and reports the missing counterpart", () => {
		const typescript_fixture = new DocumentationProjectFixture("/virtual/typescript-only", {
			"docs/rules/typescript/empty-error-handler.md": "# empty-error-handler\n",
		});
		const typescript_catalog = new RuleDocumentationCatalog(
			typescript_fixture.root,
			["empty-error-handler"],
			typescript_fixture.source_io,
		);
		const typescript_inventory = typescript_catalog.collect([]);
		const python_fixture = new DocumentationProjectFixture("/virtual/python-only", {
			"docs/rules/python/empty-error-handler.md": "# empty-error-handler\n",
		});
		const python_catalog = new RuleDocumentationCatalog(
			python_fixture.root,
			["empty-error-handler"],
			python_fixture.source_io,
		);
		const python_inventory = python_catalog.collect([]);

		expect({
			typescript: typescript_inventory.documents.map((document) => document.file_path),
			typescript_missing: typescript_inventory.missing_documents,
			python: python_inventory.documents.map((document) => document.file_path),
			python_missing: python_inventory.missing_documents,
		}).toEqual({
			typescript: ["docs/rules/typescript/empty-error-handler.md"],
			typescript_missing: ["docs/rules/python/empty-error-handler.md"],
			python: ["docs/rules/python/empty-error-handler.md"],
			python_missing: ["docs/rules/typescript/empty-error-handler.md"],
		});
	});

	test("checks only Bad and Good sections in root-level rule documents", () => {
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
		const lint_runner = new DocumentationValidationSession();
		const validator = new CliDocumentationValidation(
			fixture.root,
			["ai-code-guard-directory-ignored"],
			lint_runner,
			fixture.source_io,
		);
		const validation = lint_runner.with_worker(() => validator.validate([]));

		expect({
			results: validation.results.map(({ example, structural_errors, passed }) => [
				example.kind,
				structural_errors,
				passed,
			]),
			documents: validation.document_statuses.map(({ passed }) => passed),
		}).toEqual({
			results: [
				[ExampleKind.BAD, [], true],
				[ExampleKind.GOOD, [], true],
			],
			documents: [true],
		});
	});

	test("reports a requested rule that has no documentation file", () => {
		const fixture = new DocumentationProjectFixture("/virtual/docs", {});
		const catalog = new RuleDocumentationCatalog(fixture.root, ["empty-error-handler"], fixture.source_io);
		const inventory = catalog.collect(["missing-rule"]);

		expect({ documents: inventory.documents.length, unknown_rules: inventory.unknown_rules }).toEqual({
			documents: 0,
			unknown_rules: ["missing-rule"],
		});
	});

	test("requires a language-specific rule document in its registered directory", () => {
		const fixture = new DocumentationProjectFixture("/virtual/language-rule", {
			"docs/rules/typescript/in-operator.md": "# in-operator\n",
			"docs/rules/in-operator.md": "# misplaced\n",
			"docs/rules/python/in-operator.md": "# wrong-language-copy\n",
		});
		const documentation_catalog = new RuleDocumentationCatalog(
			fixture.root,
			["typescript-in-operator"],
			fixture.source_io,
		);
		const inventory = documentation_catalog.collect([]);
		const invalid_entries = [...inventory.invalid_entries];
		invalid_entries.sort();

		expect({
			documents: inventory.documents.map((document) => document.rule_id),
			missing: inventory.missing_documents,
			invalid: invalid_entries,
		}).toEqual({
			documents: ["typescript-in-operator"],
			missing: [],
			invalid: ["in-operator.md", "python/in-operator.md"],
		});
	});

	test("reports the canonical nested path when a language-specific document is missing", () => {
		const fixture = new DocumentationProjectFixture("/virtual/missing-language-rule", {
			"docs/rules/placeholder.md": "",
		});
		const documentation_catalog = new RuleDocumentationCatalog(fixture.root, ["python-test-shape"], fixture.source_io);
		const inventory = documentation_catalog.collect([]);

		expect(inventory.missing_documents).toEqual(["docs/rules/python/test-shape.md"]);
	});

	test("reads multi-file source directly from Markdown", () => {
		const fixture = new DocumentationProjectFixture("/virtual/inline-example", {
			"docs/rules/example-inline.md": [
				"## Bad",
				"```ts",
				"// File: src/entry.ts",
				'export class Entry { public read(): string { return "ready"; } }',
				"// File: tests/entry.test.ts",
				'import { Entry } from "src/entry";',
				'test("reads value", () => { expect(new Entry().read()).toBe("ready"); });',
				"```",
				"## Good",
				"```ts",
				"const inline_example = true;",
				"```",
			].join("\n"),
		});
		const documentation_catalog = new RuleDocumentationCatalog(fixture.root, ["example-inline"], fixture.source_io);
		const examples = documentation_catalog.describe_rule("example-inline");
		let bad = examples.examples.get(ExampleKind.BAD);
		if (bad === undefined) {
			bad = [];
		}
		const source_file = bad[0]?.source_files[0];
		const test_file = bad[0]?.source_files[1];

		expect({
			count: bad.length,
			paths: bad[0]?.source_files.map(({ path }) => path),
			source: source_file?.text,
			test: test_file?.text,
		}).toEqual({
			count: 1,
			paths: ["src/entry.ts", "tests/entry.test.ts"],
			source: 'export class Entry { public read(): string { return "ready"; } }',
			test: 'import { Entry } from "src/entry";\ntest("reads value", () => { expect(new Entry().read()).toBe("ready"); });\n',
		});
	});

	test("expands literal loops before extracting source files and removes empty loops", () => {
		const fixture = new DocumentationProjectFixture("/virtual/loop-example", {
			"docs/rules/example-loop.md": [
				"## Bad",
				"```ts",
				'{% const examples = [{"name":"First","file":"first"},{"name":"Second","file":"second"}] %}',
				"{%for item in examples %}",
				"// File: src/{{item.file}}.ts",
				"export class Example{{item.name}} {}",
				"{% endfor %}",
				"```",
				"## Good",
				"```ts",
				"{% const empty_examples = [] %}",
				"{%for unused in empty_examples %}",
				"// File: src/removed.ts",
				"{% endfor %}",
				"const example = true;",
				"```",
			].join("\n"),
		});
		const documentation_catalog = new RuleDocumentationCatalog(fixture.root, ["example-loop"], fixture.source_io);
		const document = documentation_catalog.describe_rule("example-loop");
		let bad = document.examples.get(ExampleKind.BAD);
		if (bad === undefined) {
			bad = [];
		}
		let good = document.examples.get(ExampleKind.GOOD);
		if (good === undefined) {
			good = [];
		}

		expect({
			bad_paths: bad[0]?.source_files.map((file) => file.path),
			bad_source: bad[0]?.source_files.map((file) => file.text.trim()),
			good_text: good[0]?.text.trim(),
		}).toEqual({
			bad_paths: ["src/first.ts", "src/second.ts"],
			bad_source: ["export class ExampleFirst {}", "export class ExampleSecond {}"],
			good_text: "const example = true;",
		});
	});
});
