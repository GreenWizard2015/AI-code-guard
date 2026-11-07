import { describe, expect, test } from "@jest/globals";
import { RuleDocumentationCatalog } from "documentation_validation/rule_documentation_catalog";
import { DocumentationLanguage, ExampleKind } from "documentation_validation/types";
import { DocumentationProjectFixture } from "tests/documentation_validation/documentation_project_fixture";

describe("rule documentation catalog inventory", () => {
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
		const catalog = new RuleDocumentationCatalog(fixture._root, ["empty-error-handler"], fixture._source_io);
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
			fixture._root,
			["typescript-in-operator", "python-test-shape"],
			fixture._source_io,
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
		const catalog = new RuleDocumentationCatalog(fixture._root, ["empty-error-handler"], fixture._source_io);
		const inventory = catalog.collect([]);
		expect({
			languages: inventory.documents.map(({ languages }) => languages[0]),
			example_languages: inventory.documents.flatMap((document) =>
				[ExampleKind.BAD, ExampleKind.GOOD].flatMap((kind) => {
					const examples = document.examples.get(kind);
					if (examples === undefined) {
						return [];
					}
					return examples.map(({ language }) => language);
				}),
			),
			missing_documents: inventory.missing_documents,
		}).toEqual({
			languages: [DocumentationLanguage.TYPESCRIPT, DocumentationLanguage.PYTHON],
			example_languages: [
				DocumentationLanguage.TYPESCRIPT,
				DocumentationLanguage.TYPESCRIPT,
				DocumentationLanguage.PYTHON,
				DocumentationLanguage.PYTHON,
			],
			missing_documents: [],
		});
	});

	test("collects only present shared-rule documents and reports the missing counterpart", () => {
		const typescript_fixture = new DocumentationProjectFixture("/virtual/typescript-only", {
			"docs/rules/typescript/empty-error-handler.md": "# empty-error-handler\n",
		});
		const typescript_catalog = new RuleDocumentationCatalog(
			typescript_fixture._root,
			["empty-error-handler"],
			typescript_fixture._source_io,
		);
		const typescript_inventory = typescript_catalog.collect([]);
		const python_fixture = new DocumentationProjectFixture("/virtual/python-only", {
			"docs/rules/python/empty-error-handler.md": "# empty-error-handler\n",
		});
		const python_catalog = new RuleDocumentationCatalog(
			python_fixture._root,
			["empty-error-handler"],
			python_fixture._source_io,
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
});
