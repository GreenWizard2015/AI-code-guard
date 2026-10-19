import { DocumentationLanguage } from "documentation_validation/types";
import type { DocumentationExample, ExampleResult, RuleDocumentationDocument } from "documentation_validation/types";

/** Responsibilities: _rule document language policy_, _example-language diagnostics_. **/
export class RuleDocumentLanguageCompatibility {
	private readonly neutral_rule_ids: ReadonlySet<string>;
	private readonly shared_rule_ids: ReadonlySet<string>;

	/** Responsibilities: _language-neutral document diagnostics_. **/
	private neutral_document_results(
		document: RuleDocumentationDocument,
		examples: readonly DocumentationExample[],
	): ExampleResult[] {
		if (!this.neutral_rule_ids.has(document.rule_id)) {
			return [];
		}
		return examples.map((example) => ({
			example,
			violations: [],
			structural_errors: ["language-specific examples must be documented in a language subdirectory"],
			passed: false,
		}));
	}

	/** Responsibilities: _language mismatch collection_. **/
	private language_conflicts(
		document: RuleDocumentationDocument,
		examples: readonly DocumentationExample[],
	): ExampleResult[] {
		return examples.flatMap((example) => {
			if (document.languages.includes(example.language)) {
				return [];
			}
			return [
				{
					example,
					violations: [],
					structural_errors: [`${example.language} example conflicts with the registered rule language`],
					passed: false,
				},
			];
		});
	}

	/** Responsibilities: _language policy initialization_. **/
	public constructor(neutral_rule_ids: ReadonlySet<string>, shared_rule_ids: ReadonlySet<string>) {
		this.neutral_rule_ids = neutral_rule_ids;
		this.shared_rule_ids = shared_rule_ids;
	}

	/** Responsibilities: _document example language scope_. **/
	public languages_for(
		document: RuleDocumentationDocument,
		examples: readonly DocumentationExample[],
	): readonly DocumentationLanguage[] {
		if (document.languages.length > 0) {
			return document.languages;
		}
		if (this.neutral_rule_ids.has(document.rule_id)) {
			return [];
		}
		return [...new Set(examples.map((example) => example.language))];
	}

	/** Responsibilities: _document language compatibility_. **/
	public conflicts(document: RuleDocumentationDocument, examples: readonly DocumentationExample[]): ExampleResult[] {
		if (document.languages.length === 0) {
			if (this.shared_rule_ids.has(document.rule_id)) {
				return [];
			}
			return this.neutral_document_results(document, examples);
		}
		return this.language_conflicts(document, examples);
	}
}
