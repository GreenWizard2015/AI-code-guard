import { describe, expect, test } from "@jest/globals";
import { RuleDocumentLanguageCompatibility } from "#documentation_validation/rule_document_language_compatibility";
import { SHARED_RULE_DOCUMENT_IDS, LANGUAGE_NEUTRAL_RULE_IDS } from "src/constants";
import { DocumentationLanguage, ExampleKind } from "#documentation_validation/types";
import type { DocumentationExample, RuleDocumentationDocument } from "#documentation_validation/types";

describe("shared rule documentation", () => {
	test("accepts language-specific examples in one shared document", () => {
		const compatibility = new RuleDocumentLanguageCompatibility(LANGUAGE_NEUTRAL_RULE_IDS, SHARED_RULE_DOCUMENT_IDS);
		const examples: DocumentationExample[] = [
			{
				rule_id: "directory-max-source-subdirectories",
				language: DocumentationLanguage.TYPESCRIPT,
				kind: ExampleKind.BAD,
				index: 0,
				text: "",
				source_files: [],
			},
			{
				rule_id: "directory-max-source-subdirectories",
				language: DocumentationLanguage.PYTHON,
				kind: ExampleKind.BAD,
				index: 0,
				text: "",
				source_files: [],
			},
		];
		const document: RuleDocumentationDocument = {
			rule_id: "directory-max-source-subdirectories",
			file_path: "docs/rules/directory-max-source-subdirectories.md",
			text: "",
			languages: [],
			examples: new Map([[ExampleKind.BAD, examples]]),
		};

		expect(compatibility.languages_for(document, examples)).toEqual([
			DocumentationLanguage.TYPESCRIPT,
			DocumentationLanguage.PYTHON,
		]);
		expect(compatibility.conflicts(document, examples)).toEqual([]);
	});

	test("rejects an example in the wrong language-specific document", () => {
		const compatibility = new RuleDocumentLanguageCompatibility(LANGUAGE_NEUTRAL_RULE_IDS, SHARED_RULE_DOCUMENT_IDS);
		const example: DocumentationExample = {
			rule_id: "typescript-console-in-test",
			language: DocumentationLanguage.PYTHON,
			kind: ExampleKind.BAD,
			index: 0,
			text: "",
			source_files: [],
		};
		const document: RuleDocumentationDocument = {
			rule_id: "typescript-console-in-test",
			file_path: "docs/rules/typescript/console-in-test.md",
			text: "",
			languages: [DocumentationLanguage.TYPESCRIPT],
			examples: new Map([[ExampleKind.BAD, [example]]]),
		};

		const conflicts = compatibility.conflicts(document, [example]);
		const conflict = conflicts[0];
		expect(conflict?.passed).toBe(false);
	});
});
