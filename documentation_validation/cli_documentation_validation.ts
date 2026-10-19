import { resolve } from "node:path";
import {
	DOCUMENTATION_EXCLUDED_SIZE_RULES,
	ERROR_MARKER_PATTERN,
	RESPONSIBILITY_RULE_PREFIX,
} from "documentation_validation/constants";
import { DocumentationExamplePath } from "documentation_validation/documentation_example_path";
import { DocumentationExamplePathValidation } from "documentation_validation/documentation_example_path_validation";
import { RuleDocumentLanguageCompatibility } from "documentation_validation/rule_document_language_compatibility";
import { DocumentationValidationReport } from "documentation_validation/documentation_validation_report";
import { RuleDocumentationCatalog } from "documentation_validation/rule_documentation_catalog";
import { RootRuleSectionValidation } from "documentation_validation/root_rule_section_validation";
import { LANGUAGE_NEUTRAL_RULE_IDS, SHARED_RULE_DOCUMENT_IDS } from "src/constants";

import { DocumentationLanguage, ExampleKind } from "documentation_validation/types";
import type {
	DocumentationExample,
	DocumentationExampleLintContract,
	DocumentationValidation,
	ExampleResult,
	DocumentationExampleSourceFile,
	RuleDocumentationDocument,
} from "documentation_validation/types";
import type { ViolationContract } from "src/protocols";
import type { ProjectSourceIOContract } from "src/protocols";

/** Responsibilities: _rule validation coordination_, _isolated example analysis_, _validation result delivery_. **/
export class CliDocumentationValidation {
	private readonly catalog: RuleDocumentationCatalog;
	private readonly lint_runner: DocumentationExampleLintContract;
	private readonly language_compatibility: RuleDocumentLanguageCompatibility;
	private readonly root_rule_sections: RootRuleSectionValidation;

	/** Responsibilities: _example source preparation_. **/
	private example_source_files(example: DocumentationExample, fallback_path: string): DocumentationExampleSourceFile[] {
		const files: DocumentationExampleSourceFile[] = [];
		for (const source_file of example.source_files) {
			const text = source_file.text.replace(ERROR_MARKER_PATTERN, (marker) => " ".repeat(marker.length));
			files.push({ path: source_file.path, text });
		}
		if (files.length === 0) {
			const text = example.text.replace(ERROR_MARKER_PATTERN, (marker) => " ".repeat(marker.length));
			files.push({ path: fallback_path, text });
		}
		return files;
	}

	/** Responsibilities: _document example outcomes_. **/
	private document_results(document: RuleDocumentationDocument): ExampleResult[] {
		if (this.root_rule_sections.applies(document)) {
			return this.root_rule_sections.results(document);
		}
		const results: ExampleResult[] = [];
		for (const kind of [ExampleKind.BAD, ExampleKind.GOOD]) {
			let examples = document.examples.get(kind);
			if (examples === undefined) {
				examples = [];
			}
			const languages = this.language_compatibility.languages_for(document, examples);
			for (const language of languages) {
				results.push(...this.language_results(document.rule_id, kind, language, examples));
			}
			results.push(...this.language_compatibility.conflicts(document, examples));
		}
		return results;
	}

	/** Responsibilities: _target diagnostic matching_. **/
	private target_rule_found(rule_id: string, violations: readonly ViolationContract[]): boolean {
		for (const violation of violations) {
			if (violation.rule_id === rule_id) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _relevant diagnostic selection_. **/
	private relevant_violation(rule_id: string, violation: ViolationContract): boolean {
		if (DOCUMENTATION_EXCLUDED_SIZE_RULES.has(violation.rule_id)) {
			return false;
		}
		if (violation.rule_id === rule_id) {
			return true;
		}
		if (violation.rule_id.startsWith(RESPONSIBILITY_RULE_PREFIX)) {
			return rule_id.startsWith(RESPONSIBILITY_RULE_PREFIX);
		}
		return true;
	}

	/** Responsibilities: _example expectation evaluation_. **/
	private example_passed(
		example: DocumentationExample,
		violations: readonly ViolationContract[],
		structural_errors: readonly string[],
	): boolean {
		let passed = this.target_rule_found(example.rule_id, violations);
		if (example.kind === ExampleKind.BAD) {
			if (DOCUMENTATION_EXCLUDED_SIZE_RULES.has(example.rule_id)) {
				passed = true;
			}
		}
		if (example.kind === ExampleKind.GOOD) {
			passed = violations.length === 0;
		}
		if (structural_errors.length > 0) {
			passed = false;
		}
		return passed;
	}

	/** Responsibilities: _example outcome classification_. **/
	private example_result(example: DocumentationExample, violations: readonly ViolationContract[]): ExampleResult {
		const relevant_violations = violations.filter((violation) => this.relevant_violation(example.rule_id, violation));
		const example_path = new DocumentationExamplePath(example);
		const path_validation = new DocumentationExamplePathValidation(example);
		const structural_errors = [
			...path_validation.source_path_issues(example_path.analysis_path()),
			...path_validation.cli_order_issues(),
		];
		const passed = this.example_passed(example, relevant_violations, structural_errors);
		return { example, violations: relevant_violations, structural_errors, passed };
	}

	/** Responsibilities: _missing language example result_. **/
	private missing_language_result(rule_id: string, kind: ExampleKind, language: DocumentationLanguage): ExampleResult {
		const example: DocumentationExample = {
			rule_id,
			kind,
			language,
			index: 0,
			text: "",
			source_files: [],
		};
		return { example, violations: [], structural_errors: [], passed: false };
	}

	/** Responsibilities: _one language example result_. **/
	private language_example_result(example: DocumentationExample): ExampleResult {
		const paths = new DocumentationExamplePath(example);
		const path_validation = new DocumentationExamplePathValidation(example);
		const structural_errors = [
			...path_validation.source_path_issues(paths.analysis_path()),
			...path_validation.cli_order_issues(),
		];
		let violations: readonly ViolationContract[] = [];
		if (structural_errors.length === 0) {
			violations = this.lint_example(example, paths.analysis_path());
		}
		return this.example_result(example, violations);
	}

	/** Responsibilities: _language example outcomes_. **/
	private language_results(
		rule_id: string,
		kind: ExampleKind,
		language: DocumentationLanguage,
		examples: readonly DocumentationExample[],
	): ExampleResult[] {
		const matching = examples.filter((example) => example.language === language);
		if (matching.length === 0) {
			return [this.missing_language_result(rule_id, kind, language)];
		}
		const results: ExampleResult[] = [];
		for (const example of matching) {
			results.push(this.language_example_result(example));
		}
		return results;
	}

	/** Responsibilities: _rule example collection_. **/
	/** Responsibilities: _isolated example analysis_. **/
	private lint_example(example: DocumentationExample, file: string): readonly ViolationContract[] {
		const project_root = resolve(
			"/virtual/rule-documentation-example",
			example.rule_id,
			example.language,
			`${example.kind}-${example.index}`,
		);
		const source_files = this.example_source_files(example, file);
		return this.lint_runner.lint(project_root, file, example.rule_id, source_files);
	}

	/** Responsibilities: _validation report generation_. **/
	private write_report(requested_rules: readonly string[]): number {
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
	}

	/** Responsibilities: _validator dependency ownership_. **/
	public constructor(
		root: string,
		rule_ids: readonly string[],
		lint_runner: DocumentationExampleLintContract,
		source_io: ProjectSourceIOContract,
	) {
		this.catalog = new RuleDocumentationCatalog(root, rule_ids, source_io);
		this.lint_runner = lint_runner;
		this.language_compatibility = new RuleDocumentLanguageCompatibility(
			LANGUAGE_NEUTRAL_RULE_IDS,
			SHARED_RULE_DOCUMENT_IDS,
		);
		this.root_rule_sections = new RootRuleSectionValidation(SHARED_RULE_DOCUMENT_IDS, LANGUAGE_NEUTRAL_RULE_IDS);
	}

	/** Responsibilities: _validation result assembly_. **/
	public validate(requested_rules: readonly string[]): DocumentationValidation {
		const inventory = this.catalog.collect(requested_rules);
		const collected = inventory.documents.map((document) => this.document_results(document));
		const results = collected.flat();
		const document_statuses = inventory.documents.map((document, index) => {
			const document_results = collected[index];
			let passed = false;
			if (document_results !== undefined) {
				passed = document_results.every((result) => result.passed);
			}
			return { file_name: document.file_path, passed };
		});
		const ignored_documents = collected.filter((document_results) => document_results.length === 0).length;
		return {
			results,
			document_statuses,
			ignored_documents,
			unknown_rules: inventory.unknown_rules,
			invalid_entries: inventory.invalid_entries,
			missing_documents: inventory.missing_documents,
		};
	}

	/** Responsibilities: _validation report delivery_. **/
	public run(requested_rules: readonly string[]): number {
		return this.lint_runner.with_worker(() => this.write_report(requested_rules));
	}
}
