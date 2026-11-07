import { DocumentationExampleEvaluation } from "documentation_validation/documentation_example_evaluation";
import type { DocumentationLanguage, ExampleKind } from "documentation_validation/types";
import type {
	DocumentationExample,
	DocumentationExampleExecutorContract,
	DocumentationExampleLintContract,
	ExampleResult,
	RuleDocumentationDocument,
} from "documentation_validation/types";
import { LANGUAGE_NEUTRAL_RULE_IDS, SHARED_RULE_DOCUMENT_IDS } from "src/constants";

/** Responsibilities: _document kind examples_, _language example validation_. **/
export class DocumentationExampleGroup {
	private readonly _document: RuleDocumentationDocument;
	private readonly _kind: ExampleKind;
	private readonly _examples: readonly DocumentationExample[];
	private readonly _lint_runner: DocumentationExampleLintContract;
	private readonly _executor: DocumentationExampleExecutorContract;

	/** Responsibilities: _missing language example_. **/
	private missing_language_result(language: DocumentationLanguage): ExampleResult {
		const example: DocumentationExample = {
			rule_id: this._document.rule_id,
			kind: this._kind,
			language,
			index: 0,
			text: "",
			source_files: [],
		};
		return { example, violations: [], structural_errors: [], passed: false };
	}

	/** Responsibilities: _neutral document diagnostics_. **/
	private neutral_document_results(): ExampleResult[] {
		if (!LANGUAGE_NEUTRAL_RULE_IDS.has(this._document.rule_id)) {
			return [];
		}
		return this._examples.map((example) => ({
			example,
			violations: [],
			structural_errors: ["language-specific examples must be documented in a language subdirectory"],
			passed: false,
		}));
	}

	/** Responsibilities: _language conflict collection_. **/
	private language_conflicts(): ExampleResult[] {
		return this._examples.flatMap((example) => {
			if (this._document.languages.includes(example.language)) {
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

	/** Responsibilities: _language example outcomes_. **/
	private language_results(language: DocumentationLanguage): ExampleResult[] {
		const matching = this._examples.filter((example) => example.language === language);
		if (matching.length === 0) {
			return [this.missing_language_result(language)];
		}
		return matching.map((example) => {
			const evaluation = new DocumentationExampleEvaluation(example, this._lint_runner, this._executor);
			return evaluation.language_result();
		});
	}

	/** Responsibilities: _example group initialization_. **/
	public constructor(
		document: RuleDocumentationDocument,
		kind: ExampleKind,
		examples: readonly DocumentationExample[],
		lint_runner: DocumentationExampleLintContract,
		executor: DocumentationExampleExecutorContract,
	) {
		this._document = document;
		this._kind = kind;
		this._examples = examples;
		this._lint_runner = lint_runner;
		this._executor = executor;
	}

	/** Responsibilities: _document language scope_. **/
	public languages(): readonly DocumentationLanguage[] {
		if (this._document.languages.length > 0) {
			return this._document.languages;
		}
		if (LANGUAGE_NEUTRAL_RULE_IDS.has(this._document.rule_id)) {
			return [];
		}
		return [...new Set(this._examples.map((example) => example.language))];
	}

	/** Responsibilities: _document language conflicts_. **/
	public conflicts(): ExampleResult[] {
		if (this._document.languages.length === 0) {
			if (SHARED_RULE_DOCUMENT_IDS.has(this._document.rule_id)) {
				return [];
			}
			return this.neutral_document_results();
		}
		return this.language_conflicts();
	}

	/** Responsibilities: _document example results_. **/
	public results(): ExampleResult[] {
		const results: ExampleResult[] = [];
		for (const language of this.languages()) {
			results.push(...this.language_results(language));
		}
		results.push(...this.conflicts());
		return results;
	}
}
