import { describe, expect, test } from "@jest/globals";
import { MarkdownLoopExpander } from "documentation_validation/markdown_loop_expander";
import { RuleDocumentationCatalog } from "documentation_validation/rule_documentation_catalog";
import { RuleDocumentationExamples } from "documentation_validation/rule_documentation_examples";
import { DocumentationLanguage, ExampleKind } from "documentation_validation/types";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";
import { SYSTEM_FAILURE_CODES } from "src/io/constants";
import { DocumentationProjectFixture } from "tests/documentation_validation/documentation_project_fixture";

describe("Markdown documentation example extraction and indexing", () => {
	test("expands numeric ranges as zero-based iterations", () => {
		const markdown = [
			"```ts",
			"{%for index in range(3) %}",
			"const item_{{index}} = true;",
			"{% endfor %}",
			"```",
		].join("\n");
		const expander = new MarkdownLoopExpander(new BoundaryFailureClassifier(SYSTEM_FAILURE_CODES));
		const expanded = expander.expand(markdown);

		const item_lines = expanded.split("\n").filter((line) => line.startsWith("const item_"));
		expect(item_lines).toEqual(["const item_0 = true;", "const item_1 = true;", "const item_2 = true;"]);
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
		const documentation_catalog = new RuleDocumentationCatalog(fixture._root, ["example-inline"], fixture._source_io);
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

	test("preserves fenced example order and independent language indexes", () => {
		const fixture = new DocumentationProjectFixture("/virtual/interleaved-examples", {
			"docs/rules/example-order.md": [
				"# example-order",
				"## Bad",
				"```ts",
				"// File: src/first.ts",
				"const first = true;",
				"```",
				"```python",
				"# File: src/second.py",
				"second = True",
				"```",
				"```typescript",
				"// File: src/third.ts",
				"const third = true;",
				"```",
				"## Good",
				"```py",
				"# File: tests/example.py",
				"example = True",
				"```",
			].join("\n"),
		});
		const catalog = new RuleDocumentationCatalog(fixture._root, ["example-order"], fixture._source_io);
		const document = catalog.describe_rule("example-order");
		const bad_examples = document.examples.get(ExampleKind.BAD) ?? [];
		const good_examples = document.examples.get(ExampleKind.GOOD) ?? [];

		expect({
			bad: bad_examples.map(({ language, index, source_files }) => [language, index, source_files[0]?.path]),
			good: good_examples.map(({ language, index, source_files }) => [language, index, source_files[0]?.path]),
		}).toEqual({
			bad: [
				[DocumentationLanguage.TYPESCRIPT, 0, "src/first.ts"],
				[DocumentationLanguage.PYTHON, 0, "src/second.py"],
				[DocumentationLanguage.TYPESCRIPT, 1, "src/third.ts"],
			],
			good: [[DocumentationLanguage.PYTHON, 0, "tests/example.py"]],
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
		const documentation_catalog = new RuleDocumentationCatalog(fixture._root, ["example-loop"], fixture._source_io);
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

	test("indexes and reuses both documented example groups", () => {
		const markdown = "## Bad\n```ts\nconst invalid = true;\n```\n## Good\n```python\nvalid = True\n```";
		const parser = new RuleDocumentationExamples(markdown);
		const bad_examples = parser.bad_examples();
		const good_examples = parser.good_examples();
		expect({
			bad: bad_examples.map(({ kind, language, index }) => [kind, language, index]),
			good: good_examples.map(({ kind, language, index }) => [kind, language, index]),
			cached: [parser.bad_examples() === bad_examples, parser.good_examples() === good_examples],
		}).toEqual({
			bad: [[ExampleKind.BAD, DocumentationLanguage.TYPESCRIPT, 0]],
			good: [[ExampleKind.GOOD, DocumentationLanguage.PYTHON, 0]],
			cached: [true, true],
		});
	});
});
