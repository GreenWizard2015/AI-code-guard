import { DocumentationExampleGroup } from "documentation_validation/documentation_example_group";
import { DocumentationValidationReport } from "documentation_validation/documentation_validation_report";
import { RootRuleSectionValidation } from "documentation_validation/root_rule_section_validation";
import { RuleDocumentationCatalog } from "documentation_validation/rule_documentation_catalog";

import { DocumentationLanguage, ExampleKind } from "documentation_validation/types";
import type {
	DocumentationDocumentStatus,
	DocumentationExample,
	DocumentationExampleExecutorContract,
	DocumentationExampleLintContract,
	DocumentationExampleValidationBatch,
	DocumentationValidation,
	ExampleResult,
	RuleDocumentationDocument,
	RuleDocumentationLineCount,
} from "documentation_validation/types";
import type { ProjectSourceIOContract } from "src/source_protocols";

/** Responsibilities: _rule validation coordination_, _isolated example analysis_, _validation result delivery_. **/
export class CliDocumentationValidation {
	private readonly _catalog: RuleDocumentationCatalog;
	private readonly _lint_runner: DocumentationExampleLintContract;
	private readonly _executor: DocumentationExampleExecutorContract;

	/** Responsibilities: _document example outcomes_. **/
	private document_results(document: RuleDocumentationDocument): ExampleResult[] {
		const root_sections = new RootRuleSectionValidation(document);
		if (root_sections.applies()) {
			return root_sections.results();
		}
		const results: ExampleResult[] = [];
		for (const kind of [ExampleKind.BAD, ExampleKind.GOOD]) {
			const stored_examples = document.examples.get(kind);
			let examples: readonly DocumentationExample[] = [];
			if (stored_examples !== undefined) {
				examples = stored_examples;
			}
			const group = new DocumentationExampleGroup(document, kind, examples, this._lint_runner, this._executor);
			results.push(...group.results());
		}
		return results;
	}

	/** Responsibilities: _document result batch assembly_. **/
	private document_batch(documents: readonly RuleDocumentationDocument[]): DocumentationExampleValidationBatch {
		const results: ExampleResult[] = [];
		const document_statuses: DocumentationDocumentStatus[] = [];
		let ignored_documents = 0;
		for (const document of documents) {
			const document_results = this.document_results(document);
			results.push(...document_results);
			document_statuses.push({
				file_name: document.file_path,
				passed: document_results.every((result) => result.passed),
			});
			if (document_results.length === 0) {
				ignored_documents += 1;
			}
		}
		return { results, document_statuses, ignored_documents };
	}

	/** Responsibilities: _rule document line counts_. **/
	private document_line_counts(documents: readonly RuleDocumentationDocument[]): RuleDocumentationLineCount[] {
		const line_counts: RuleDocumentationLineCount[] = [];
		for (const document of documents) {
			if (document.languages.length === 0 || document.languages.includes(DocumentationLanguage.TYPESCRIPT)) {
				line_counts.push({
					rule_id: document.rule_id,
					language: DocumentationLanguage.TYPESCRIPT,
					line_count: document.line_count,
				});
			}
			if (document.languages.length === 0 || document.languages.includes(DocumentationLanguage.PYTHON)) {
				line_counts.push({
					rule_id: document.rule_id,
					language: DocumentationLanguage.PYTHON,
					line_count: document.line_count,
				});
			}
		}
		return line_counts;
	}

	/** Responsibilities: _validator dependency ownership_. **/
	public constructor(
		root: string,
		rule_ids: readonly string[],
		lint_runner: DocumentationExampleLintContract,
		executor: DocumentationExampleExecutorContract,
		source_io: ProjectSourceIOContract,
	) {
		this._catalog = new RuleDocumentationCatalog(root, rule_ids, source_io);
		this._lint_runner = lint_runner;
		this._executor = executor;
	}

	/** Responsibilities: _validation result assembly_. **/
	public validate(requested_rules: readonly string[]): DocumentationValidation {
		const inventory = this._catalog.collect(requested_rules);
		const batch = this.document_batch(inventory.documents);
		return {
			results: batch.results,
			document_statuses: batch.document_statuses,
			document_line_counts: this.document_line_counts(inventory.documents),
			ignored_documents: batch.ignored_documents,
			unknown_rules: inventory.unknown_rules,
			invalid_entries: inventory.invalid_entries,
			missing_documents: inventory.missing_documents,
		};
	}

	/** Responsibilities: _validation report delivery_. **/
	public run(requested_rules: readonly string[]): Promise<number> {
		return this._lint_runner.with_worker(() =>
			Promise.resolve().then(() => {
				const validation = this.validate(requested_rules);
				const report = new DocumentationValidationReport(validation);
				report.write();
				if (validation.unknown_rules.length > 0) {
					return 2;
				}
				if (validation.invalid_entries.length > 0) {
					return 2;
				}
				if (validation.missing_documents.length > 0) {
					return 2;
				}
				return report.failure_count() > 0 ? 1 : 0;
			}),
		);
	}
}
