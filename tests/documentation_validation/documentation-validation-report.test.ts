import assert from "node:assert/strict";
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

	test("ranks the ten longest TypeScript rule documents", () => {
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
		assert.ok(ranked_typescript_documents);
		const typescript_first = ranked_typescript_documents[0];
		assert.ok(typescript_first);
		const typescript_tenth = ranked_typescript_documents[9];
		assert.ok(typescript_tenth);

		expect({
			count: ranked_typescript_documents.length,
			first: typescript_first.rule_id,
			tenth: typescript_tenth.rule_id,
		}).toEqual({ count: 10, first: "typescript-rule-1", tenth: "typescript-rule-10" });
	});

	test("ranks the ten longest Python rule documents", () => {
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
			document_statuses: [{ file_name: "docs/rules/python/rule-1.md", passed: true }],
			document_line_counts: [...typescript_documents, ...python_documents],
			ignored_documents: 0,
			unknown_rules: [],
			invalid_entries: [],
			missing_documents: [],
		});
		const ranked_python_documents = report.longest_documents().get(DocumentationLanguage.PYTHON);
		assert.ok(ranked_python_documents);
		const python_first = ranked_python_documents[0];
		assert.ok(python_first);
		const python_tenth = ranked_python_documents[9];
		assert.ok(python_tenth);

		expect({
			count: ranked_python_documents.length,
			first: python_first.rule_id,
			tenth: python_tenth.rule_id,
		}).toEqual({
			count: 10,
			first: "python-rule-1",
			tenth: "python-rule-10",
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
