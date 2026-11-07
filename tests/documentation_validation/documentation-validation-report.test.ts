import { describe, expect, test } from "@jest/globals";
import { DocumentationValidationReport } from "documentation_validation/documentation_validation_report";
import { DocumentationLanguage, ExampleKind } from "documentation_validation/types";

describe("documentation validation report", () => {
	test("counts failed examples without treating passing examples as failures", () => {
		const report = new DocumentationValidationReport({
			results: [
				{
					example: {
						rule_id: "empty-error-handler",
						kind: ExampleKind.BAD,
						language: DocumentationLanguage.TYPESCRIPT,
						index: 0,
						text: "",
						source_files: [],
					},
					violations: [],
					structural_errors: [],
					passed: true,
				},
				{
					example: {
						rule_id: "empty-error-handler",
						kind: ExampleKind.GOOD,
						language: DocumentationLanguage.PYTHON,
						index: 0,
						text: "",
						source_files: [],
					},
					violations: [],
					structural_errors: [],
					passed: false,
				},
			],
			document_statuses: [{ file_name: "docs/rules/empty-error-handler.md", passed: false }],
			document_line_counts: [],
			ignored_documents: 0,
			unknown_rules: [],
			invalid_entries: [],
			missing_documents: [],
		});

		expect(report.failure_count()).toBe(1);
	});

	test("reports no failures when every validated example passes", () => {
		const report = new DocumentationValidationReport({
			results: [],
			document_statuses: [{ file_name: "docs/rules/empty-error-handler.md", passed: true }],
			document_line_counts: [],
			ignored_documents: 0,
			unknown_rules: [],
			invalid_entries: [],
			missing_documents: [],
		});

		expect(report.failure_count()).toBe(0);
	});

	test("ranks clean rule documents separately for each language", () => {
		const typescript_documents = Array.from({ length: 12 }, (_, index) => ({
			rule_id: `typescript-rule-${index + 1}`,
			language: DocumentationLanguage.TYPESCRIPT,
			line_count: 12 - index,
		}));
		const python_documents = Array.from({ length: 12 }, (_, index) => ({
			rule_id: `python-rule-${index + 1}`,
			language: DocumentationLanguage.PYTHON,
			line_count: 24 - index,
		}));
		const report = new DocumentationValidationReport({
			results: [],
			document_statuses: [{ file_name: "docs/rules/typescript/rule-1.md", passed: true }],
			document_line_counts: [...typescript_documents, ...python_documents],
			ignored_documents: 0,
			unknown_rules: [],
			invalid_entries: [],
			missing_documents: [],
		});
		const rankings = report.longest_documents();
		const ranked_typescript_documents = rankings.get(DocumentationLanguage.TYPESCRIPT);
		const ranked_python_documents = rankings.get(DocumentationLanguage.PYTHON);
		const typescript_first = ranked_typescript_documents?.[0];
		const typescript_tenth = ranked_typescript_documents?.[9];
		const python_first = ranked_python_documents?.[0];
		const python_tenth = ranked_python_documents?.[9];

		expect({
			typescript: [ranked_typescript_documents?.length, typescript_first?.rule_id, typescript_tenth?.rule_id],
			python: [ranked_python_documents?.length, python_first?.rule_id, python_tenth?.rule_id],
		}).toEqual({
			typescript: [10, "typescript-rule-1", "typescript-rule-10"],
			python: [10, "python-rule-1", "python-rule-10"],
		});
	});

	test("does not rank rule documents when documentation has failures", () => {
		const report = new DocumentationValidationReport({
			results: [],
			document_statuses: [{ file_name: "docs/rules/typescript/rule-1.md", passed: false }],
			document_line_counts: [{ rule_id: "rule-1", language: DocumentationLanguage.TYPESCRIPT, line_count: 30 }],
			ignored_documents: 0,
			unknown_rules: [],
			invalid_entries: [],
			missing_documents: [],
		});
		const rankings = report.longest_documents();

		expect({
			typescript: rankings.get(DocumentationLanguage.TYPESCRIPT),
			python: rankings.get(DocumentationLanguage.PYTHON),
		}).toEqual({ typescript: [], python: [] });
	});
});
