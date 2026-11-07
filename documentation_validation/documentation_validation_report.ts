import type {
	DocumentationDocumentStatus,
	DocumentationExampleKeysByRule,
	DocumentationValidation,
	ExampleResult,
	RuleDocumentationLineCount,
} from "documentation_validation/types";
import { DocumentationLanguage } from "documentation_validation/types";
import {
	EMPTY_REPORT_MARKDOWN_ROW,
	REPORT_MARKDOWN_DIVIDER,
	REPORT_MARKDOWN_HEADER,
	TWO_COLUMN_MARKDOWN_DIVIDER,
} from "src/constants";

/** Responsibilities: _validation outcome ownership_, _diagnostic summary reporting_. **/
export class DocumentationValidationReport {
	private readonly _results: readonly ExampleResult[];
	private readonly _document_statuses: readonly DocumentationDocumentStatus[];
	private readonly _ignored_documents: number;
	private readonly _unknown_rules: readonly string[];
	private readonly _invalid_entries: readonly string[];
	private readonly _missing_documents: readonly string[];
	private readonly _document_line_counts: readonly RuleDocumentationLineCount[];

	/** Responsibilities: _diagnostic counts_. **/
	private diagnostic_counts(): Map<string, number> {
		const counts = new Map<string, number>();
		for (const result of this._results) {
			for (const violation of result.violations) {
				let count = counts.get(violation.rule_id());
				if (count === undefined) {
					count = 0;
				}
				counts.set(violation.rule_id(), count + 1);
			}
		}
		const ordered_counts = [...counts.entries()];
		ordered_counts.sort((left, right) => {
			const count_order = right[1] - left[1];
			if (count_order !== 0) {
				return count_order;
			}
			return left[0].localeCompare(right[0]);
		});
		return new Map(ordered_counts);
	}

	/** Responsibilities: _diagnostic example grouping_. **/
	private diagnostic_file_counts(): Map<string, number> {
		const files = new Map<string, Set<string>>();
		for (const result of this._results) {
			const example = result.example;
			const example_key = `${example.rule_id}/${example.language}/${example.kind}/${example.index}`;
			for (const violation of result.violations) {
				let examples = files.get(violation.rule_id());
				if (examples === undefined) {
					examples = new Set<string>();
					files.set(violation.rule_id(), examples);
				}
				examples.add(example_key);
			}
		}
		return this.example_counts(files);
	}

	/** Responsibilities: _unique diagnostic example counts_. **/
	private example_counts(files: DocumentationExampleKeysByRule): Map<string, number> {
		const file_counts = new Map<string, number>();
		for (const [rule_id, examples] of files) {
			file_counts.set(rule_id, examples.size);
		}
		return file_counts;
	}

	/** Responsibilities: _catalog error reporting_. **/
	private write_catalog_errors(): void {
		for (const rule_id of this._unknown_rules) {
			console.error(`Unknown rule document: ${rule_id}`);
		}
		for (const entry of this._invalid_entries) {
			console.error(`Invalid or misplaced rule document: docs/rules/${entry}`);
		}
		for (const document_path of this._missing_documents) {
			console.error(`Missing rule document: ${document_path}`);
		}
	}

	/** Responsibilities: _example outcome reporting_. **/
	private write_example_results(failures: readonly ExampleResult[]): void {
		for (const failure of failures) {
			console.error(this.failure_message(failure));
		}
		console.log(
			`Validated ${this._results.length} documentation examples; ${failures.length} failed; ${this._ignored_documents} non-source documents skipped.`,
		);
	}

	/** Responsibilities: _per-document validation outcome reporting_. **/
	private write_document_statuses(): void {
		for (const document of this._document_statuses) {
			const status = document.passed ? "OK" : "ERROR";
			console.log(`${document.file_name} - ${status}`);
		}
	}

	/** Responsibilities: _diagnostic summary reporting_. **/
	private write_diagnostic_counts(): void {
		const diagnostic_counts = this.diagnostic_counts();
		const file_counts = this.diagnostic_file_counts();
		console.log(`\n${REPORT_MARKDOWN_HEADER}`);
		console.log(REPORT_MARKDOWN_DIVIDER);
		for (const [rule_id, count] of diagnostic_counts) {
			let file_count = file_counts.get(rule_id);
			if (file_count === undefined) {
				file_count = 0;
			}
			console.log(`| ${rule_id} | ${count} | ${file_count} |`);
		}
		if (diagnostic_counts.size === 0) {
			console.log(EMPTY_REPORT_MARKDOWN_ROW);
		}
	}

	/** Responsibilities: _validation outcome_. **/
	private validation_is_clean(): boolean {
		const has_catalog_errors =
			this._unknown_rules.length > 0 || this._invalid_entries.length > 0 || this._missing_documents.length > 0;
		const has_failed_documents = this._document_statuses.some((document) => !document.passed);
		const has_failed_examples = this._results.some((result) => !result.passed);
		if (has_catalog_errors) {
			return false;
		}
		if (has_failed_documents) {
			return false;
		}
		return !has_failed_examples;
	}

	/** Responsibilities: _longest rule-document reporting_. **/
	private write_line_counts(label: string, documents: readonly RuleDocumentationLineCount[]): void {
		console.log(`\nTop 10 ${label} rule documents by line count`);
		console.log("| Rule | Lines |");
		console.log(TWO_COLUMN_MARKDOWN_DIVIDER);
		for (const document of documents) {
			console.log(`| ${document.rule_id} | ${document.line_count} |`);
		}
		if (documents.length === 0) {
			console.log("| — | 0 |");
		}
	}

	/** Responsibilities: _document size ranking output_. **/
	private write_size_report(): void {
		if (!this.validation_is_clean()) {
			return;
		}
		const rankings = this.longest_documents();
		const typescript_documents = rankings.get(DocumentationLanguage.TYPESCRIPT) ?? [];
		const python_documents = rankings.get(DocumentationLanguage.PYTHON) ?? [];
		this.write_line_counts("TypeScript", typescript_documents);
		this.write_line_counts("Python", python_documents);
	}

	/** Responsibilities: _example failure messages_. **/
	private failure_message(result: ExampleResult): string {
		const violation_message = result.violations
			.map((violation) => `${violation.rule_id()}@${violation.file()}:${violation.line()}`)
			.join(", ");
		const message_parts = [violation_message, ...result.structural_errors];
		const nonempty_message_parts = message_parts.filter((item) => item.length > 0);
		let message = nonempty_message_parts.join(", ");
		if (message.length === 0) {
			message = "missing example or target diagnostic";
		}
		const example = result.example;
		return `${example.rule_id} ${example.language} ${example.kind} #${example.index + 1}: ${message}`;
	}

	/** Responsibilities: _report initialization_. **/
	public constructor(validation: DocumentationValidation) {
		this._results = validation.results;
		this._document_statuses = validation.document_statuses;
		this._ignored_documents = validation.ignored_documents;
		this._unknown_rules = validation.unknown_rules;
		this._invalid_entries = validation.invalid_entries;
		this._missing_documents = validation.missing_documents;
		this._document_line_counts = validation.document_line_counts;
	}

	/** Responsibilities: _language rule-document ranking_. **/
	public longest_documents(): ReadonlyMap<DocumentationLanguage, readonly RuleDocumentationLineCount[]> {
		const rankings = new Map<DocumentationLanguage, readonly RuleDocumentationLineCount[]>();
		for (const language of [DocumentationLanguage.TYPESCRIPT, DocumentationLanguage.PYTHON]) {
			const documents = this._document_line_counts.filter((document) => document.language === language);
			documents.sort((left, right) => right.line_count - left.line_count || left.rule_id.localeCompare(right.rule_id));
			let top_documents: readonly RuleDocumentationLineCount[] = [];
			if (this.validation_is_clean()) {
				top_documents = documents.slice(0, 10);
			}
			rankings.set(language, top_documents);
		}
		return rankings;
	}

	/** Responsibilities: _failed example count_. **/
	public failure_count(): number {
		return this._results.filter((result) => !result.passed).length;
	}

	/** Responsibilities: _diagnostic report output_. **/
	public write(): void {
		this.write_catalog_errors();
		this.write_document_statuses();
		const failures = this._results.filter((result) => !result.passed);
		this.write_example_results(failures);
		this.write_diagnostic_counts();
		this.write_size_report();
	}
}
