import { DocumentationLanguage, ExampleKind } from "#documentation_validation/types";
import type { ExampleResult, RuleDocumentationDocument, DocumentationExample } from "#documentation_validation/types";

/** Responsibilities: _root rule section policy_, _rule example validation_. **/
export class RootRuleSectionValidation {
	private readonly shared_rule_ids: ReadonlySet<string>;
	private readonly neutral_rule_ids: ReadonlySet<string>;

	/** Responsibilities: _root rule section example_. **/
	private section_example(
		document: RuleDocumentationDocument,
		kind: ExampleKind,
		headings: ReadonlySet<string>,
	): ExampleResult {
		const present = headings.has(kind);
		const structural_errors: string[] = [];
		if (!present) {
			structural_errors.push(`missing ## ${kind} section`);
		}
		const example: DocumentationExample = {
			rule_id: document.rule_id,
			kind,
			language: DocumentationLanguage.STRUCTURE,
			index: 0,
			text: "",
			source_files: [],
		};
		return { example, violations: [], structural_errors, passed: present };
	}

	/** Responsibilities: _root section policy dependencies_. **/
	public constructor(shared_rule_ids: ReadonlySet<string>, neutral_rule_ids: ReadonlySet<string>) {
		this.shared_rule_ids = shared_rule_ids;
		this.neutral_rule_ids = neutral_rule_ids;
	}

	/** Responsibilities: _shared rule applicability_. **/
	public applies(document: RuleDocumentationDocument): boolean {
		const segments = document.file_path.split("/");
		const root_document = segments.length === 3 && segments[0] === "docs" && segments[1] === "rules";
		const shared_document = this.shared_rule_ids.has(document.rule_id) || this.neutral_rule_ids.has(document.rule_id);
		return root_document && shared_document;
	}

	/** Responsibilities: _root section validation_. **/
	public results(document: RuleDocumentationDocument): ExampleResult[] {
		const heading_matches = [...document.text.matchAll(/^##\s+(Bad|Good)\s*$/gmu)];
		const headings = new Set<string>();
		for (const match of heading_matches) {
			const heading = match[1];
			if (heading !== undefined) {
				headings.add(heading);
			}
		}
		return [ExampleKind.BAD, ExampleKind.GOOD].map((kind) => this.section_example(document, kind, headings));
	}
}
