import type {
	DocumentationDocumentStatus,
	DocumentationExampleKeysByRule,
	DocumentationValidation,
	ExampleResult,
} from "documentation_validation/types";
import {
	DOCUMENTATION_REPORT_DIVIDER,
	DOCUMENTATION_REPORT_HEADER,
	EMPTY_DOCUMENTATION_REPORT_ROW,
} from "documentation_validation/constants";

/** Responsibilities: _validation outcome ownership_, _diagnostic summary reporting_. **/
export class DocumentationValidationReport {
	private readonly results: readonly ExampleResult[];
	private readonly document_statuses: readonly DocumentationDocumentStatus[];
	private readonly ignored_documents: number;
	private readonly unknown_rules: readonly string[];
	private readonly invalid_entries: readonly string[];
	private readonly missing_documents: readonly string[];

	/** Responsibilities: _diagnostic counts_. **/
	private diagnostic_counts(): Map<string, number> {
		const counts = new Map<string, number>();
		for (const result of this.results) {
			for (const violation of result.violations) {
				let count = counts.get(violation.rule_id);
				if (count === undefined) {
					count = 0;
				}
				counts.set(violation.rule_id, count + 1);
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
		for (const result of this.results) {
			const example = result.example;
			const example_key = `${example.rule_id}/${example.language}/${example.kind}/${example.index}`;
			for (const violation of result.violations) {
				let examples = files.get(violation.rule_id);
				if (examples === undefined) {
					examples = new Set<string>();
					files.set(violation.rule_id, examples);
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
		for (const rule_id of this.unknown_rules) {
			console.error(`Unknown rule document: ${rule_id}`);
		}
		for (const entry of this.invalid_entries) {
			console.error(`Invalid or misplaced rule document: docs/rules/${entry}`);
		}
		for (const document_path of this.missing_documents) {
			console.error(`Missing rule document: ${document_path}`);
		}
	}

	/** Responsibilities: _example outcome reporting_. **/
	private write_example_results(failures: readonly ExampleResult[]): void {
		for (const failure of failures) {
			console.error(this.failure_message(failure));
		}
		console.log(
			`Validated ${this.results.length} documentation examples; ${failures.length} failed; ${this.ignored_documents} non-source documents skipped.`,
		);
	}

	/** Responsibilities: _per-document validation outcome reporting_. **/
	private write_document_statuses(): void {
		for (const document of this.document_statuses) {
			const status = document.passed ? "ок" : "ошибка";
			console.log(`${document.file_name} - ${status}`);
		}
	}

	/** Responsibilities: _diagnostic summary reporting_. **/
	private write_diagnostic_counts(): void {
		const diagnostic_counts = this.diagnostic_counts();
		const file_counts = this.diagnostic_file_counts();
		console.log(`\n${DOCUMENTATION_REPORT_HEADER}`);
		console.log(DOCUMENTATION_REPORT_DIVIDER);
		for (const [rule_id, count] of diagnostic_counts) {
			let file_count = file_counts.get(rule_id);
			if (file_count === undefined) {
				file_count = 0;
			}
			console.log(`| ${rule_id} | ${count} | ${file_count} |`);
		}
		if (diagnostic_counts.size === 0) {
			console.log(EMPTY_DOCUMENTATION_REPORT_ROW);
		}
	}

	/** Responsibilities: _example failure messages_. **/
	private failure_message(result: ExampleResult): string {
		const violation_message = result.violations
			.map((violation) => `${violation.rule_id}@${violation.file}:${violation.line}`)
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
		this.results = validation.results;
		this.document_statuses = validation.document_statuses;
		this.ignored_documents = validation.ignored_documents;
		this.unknown_rules = validation.unknown_rules;
		this.invalid_entries = validation.invalid_entries;
		this.missing_documents = validation.missing_documents;
	}

	/** Responsibilities: _failed example count_. **/
	public failure_count(): number {
		return this.results.filter((result) => !result.passed).length;
	}

	/** Responsibilities: _diagnostic report output_. **/
	public write(): void {
		this.write_catalog_errors();
		this.write_document_statuses();
		const failures = this.results.filter((result) => !result.passed);
		this.write_example_results(failures);
		this.write_diagnostic_counts();
	}
}
