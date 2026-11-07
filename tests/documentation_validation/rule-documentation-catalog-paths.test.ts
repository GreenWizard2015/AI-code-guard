import { describe, expect, test } from "@jest/globals";
import { RuleDocumentationCatalog } from "documentation_validation/rule_documentation_catalog";
import { DocumentationProjectFixture } from "tests/documentation_validation/documentation_project_fixture";

describe("rule documentation catalog paths", () => {
	test("reports a requested rule that has no documentation file", () => {
		const fixture = new DocumentationProjectFixture("/virtual/docs", {});
		const catalog = new RuleDocumentationCatalog(fixture._root, ["empty-error-handler"], fixture._source_io);
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
			fixture._root,
			["typescript-in-operator"],
			fixture._source_io,
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
		const documentation_catalog = new RuleDocumentationCatalog(
			fixture._root,
			["python-test-shape"],
			fixture._source_io,
		);
		const inventory = documentation_catalog.collect([]);

		expect(inventory.missing_documents).toEqual(["docs/rules/python/test-shape.md"]);
	});
});
