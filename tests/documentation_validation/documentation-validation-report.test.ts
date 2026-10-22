import { describe, expect, test } from "@jest/globals";
import { DocumentationValidationReport } from "#documentation_validation/documentation_validation_report";
import { DocumentationLanguage, ExampleKind } from "#documentation_validation/types";

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
			ignored_documents: 0,
			unknown_rules: [],
			invalid_entries: [],
			missing_documents: [],
		});

		expect(report.failure_count()).toBe(0);
	});
});
