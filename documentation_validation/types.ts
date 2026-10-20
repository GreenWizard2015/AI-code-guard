import type { ViolationContract } from "src/reporting_protocols";

export enum DocumentationLanguage {
	TYPESCRIPT = "ts",
	PYTHON = "py",
	STRUCTURE = "text",
}

export enum ExampleKind {
	GOOD = "Good",
	BAD = "Bad",
}

export type DocumentationExampleSourceFile = {
	path: string;
	text: string;
};

export type DocumentationExample = {
	rule_id: string;
	language: DocumentationLanguage;
	kind: ExampleKind;
	index: number;
	text: string;
	source_files: readonly DocumentationExampleSourceFile[];
};

export type DocumentationExampleKeys = ReadonlySet<string>;
export type DocumentationExampleKeysByRule = ReadonlyMap<string, DocumentationExampleKeys>;

export type ExampleResult = {
	example: DocumentationExample;
	violations: readonly ViolationContract[];
	structural_errors: readonly string[];
	passed: boolean;
};

export type RuleDocumentationDocument = {
	rule_id: string;
	file_path: string;
	text: string;
	languages: readonly DocumentationLanguage[];
	examples: ReadonlyMap<ExampleKind, readonly DocumentationExample[]>;
};

export type RuleDocumentationInventory = {
	documents: readonly RuleDocumentationDocument[];
	unknown_rules: readonly string[];
	invalid_entries: readonly string[];
	missing_documents: readonly string[];
};

export type RuleDocumentPath = {
	rule_id: string;
	file_path: string;
};

export type RuleDocumentationPathInventory = {
	present_documents: readonly RuleDocumentPath[];
	registered_rule_ids: ReadonlySet<string>;
	invalid_entries: readonly string[];
	missing_documents: readonly string[];
};

export type RuleDocumentPresence = {
	present_documents: RuleDocumentPath[];
	missing_documents: string[];
};

export type DocumentationValidation = {
	results: readonly ExampleResult[];
	document_statuses: readonly DocumentationDocumentStatus[];
	ignored_documents: number;
	unknown_rules: readonly string[];
	invalid_entries: readonly string[];
	missing_documents: readonly string[];
};

export type DocumentationDocumentStatus = {
	file_name: string;
	passed: boolean;
};

export type DocumentationValidationOperation<T> = () => T;

/** Responsibilities: _example lint integration_, _worker lifecycle_. **/
export interface DocumentationExampleLintContract {
	lint(
		repo_root: string,
		source_path: string,
		rule_id: string,
		source_files: readonly DocumentationExampleSourceFile[],
	): readonly ViolationContract[];
	with_worker<T>(operation: DocumentationValidationOperation<T>): T;
}
