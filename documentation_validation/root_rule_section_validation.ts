import { DocumentationLanguage, ExampleKind } from "documentation_validation/types";
import type { DocumentationExample, ExampleResult, RuleDocumentationDocument } from "documentation_validation/types";
import { LANGUAGE_NEUTRAL_RULE_IDS, SHARED_RULE_DOCUMENT_IDS } from "src/constants";

/** Responsibilities: _root rule section policy_, _rule example validation_. **/
export class RootRuleSectionValidation {
	private readonly _document: RuleDocumentationDocument;

	/** Responsibilities: _root rule section example_. **/
	private section_example(kind: ExampleKind, headings: ReadonlySet<string>): ExampleResult {
		const present = headings.has(kind);
		const structural_errors: string[] = [];
		if (!present) {
			structural_errors.push(`missing ## ${kind} section`);
		}
		const example: DocumentationExample = {
			rule_id: this._document.rule_id,
			kind,
			language: DocumentationLanguage.STRUCTURE,
			index: 0,
			text: "",
			source_files: [],
		};
		return { example, violations: [], structural_errors, passed: present };
	}

	/** Responsibilities: _root section policy dependencies_. **/
	public constructor(document: RuleDocumentationDocument) {
		this._document = document;
	}

	/** Responsibilities: _shared rule applicability_. **/
	public applies(): boolean {
		const segments = this._document.file_path.split("/");
		const root_document = segments.length === 3 && segments[0] === "docs" && segments[1] === "rules";
		const shared_document =
			SHARED_RULE_DOCUMENT_IDS.has(this._document.rule_id) || LANGUAGE_NEUTRAL_RULE_IDS.has(this._document.rule_id);
		return root_document && shared_document;
	}

	/** Responsibilities: _root section validation_. **/
	public results(): ExampleResult[] {
		const heading_matches = [...this._document.text.matchAll(/^##\s+(Bad|Good)\s*$/gmu)];
		const headings = new Set<string>();
		for (const match of heading_matches) {
			const heading = match[1];
			if (heading !== undefined) {
				headings.add(heading);
			}
		}
		return [ExampleKind.BAD, ExampleKind.GOOD].map((kind) => this.section_example(kind, headings));
	}
}
