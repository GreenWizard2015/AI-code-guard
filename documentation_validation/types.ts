import type { SpawnSyncOptionsWithStringEncoding, SpawnSyncReturns } from "node:child_process";
import type { DocumentationExampleExpectationContract } from "documentation_validation/protocols";
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

/** Responsibilities: _documentation example source path_, _source text_. **/
export type DocumentationExampleSourceFile = {
	readonly path: string;
	readonly text: string;
};

export type DocumentationExampleSourceFiles = readonly DocumentationExampleSourceFile[];

export type DocumentationExample = {
	rule_id: string;
	language: DocumentationLanguage;
	kind: ExampleKind;
	index: number;
	text: string;
	source_files: DocumentationExampleSourceFiles;
};

export type RuleDocumentationExampleData = {
	readonly kind: ExampleKind;
	readonly language: DocumentationLanguage;
	readonly index: number;
	readonly text: string;
	readonly source_files: DocumentationExampleSourceFiles;
};

export type DocumentationExampleExecution = {
	readonly stdout: string;
	readonly exit_code: number;
};

export type DocumentationPythonSandboxResponse = {
	readonly stdout: string;
	readonly exit_code: number;
	readonly error: string;
};

export type DocumentationTestResult = {
	readonly done: boolean;
	readonly error: string;
};

export type DocumentationPythonProcessResult = SpawnSyncReturns<string>;

export type DocumentationPythonProcessRequest = {
	readonly entry: string;
	readonly test_files: readonly string[];
};

export type CallableDocumentationPythonProcessRunner = (
	command: string,
	arguments_: readonly string[],
	options: SpawnSyncOptionsWithStringEncoding,
) => DocumentationPythonProcessResult;

export type CallableDocumentationTestCallback = () => void;
export type CallableDocumentationTestRegistration = (name: string, callback: CallableDocumentationTestCallback) => void;
export type CallableDocumentationSuiteRegistration = (
	name: string,
	callback: CallableDocumentationTestCallback,
) => void;
export type CallableDocumentationBeforeEach = (callback: CallableDocumentationTestCallback) => void;
export type CallableDocumentationExpectationFactory = <T>(actual: T) => DocumentationExampleExpectationContract<T>;

/** Responsibilities: _documented example execution_. **/
export interface DocumentationExampleExecutorContract {
	capture_output(example: DocumentationExample): DocumentationExampleExecution;
}

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
	line_count: number;
	languages: readonly DocumentationLanguage[];
	examples: ReadonlyMap<ExampleKind, readonly DocumentationExample[]>;
};

export type RuleDocumentationLineCount = {
	readonly rule_id: string;
	readonly language: DocumentationLanguage;
	readonly line_count: number;
};

export type TypeScriptExampleModuleRequest = {
	readonly specifier: string;
	readonly parent_path: string;
};

/** Responsibilities: _runtime module identity_, _runtime module source text_. **/
export type TypeScriptExampleModuleSource = {
	readonly module_path: string;
	readonly source_text: string;
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
	document_line_counts: readonly RuleDocumentationLineCount[];
	ignored_documents: number;
	unknown_rules: readonly string[];
	invalid_entries: readonly string[];
	missing_documents: readonly string[];
};

export type DocumentationExampleValidationBatch = {
	readonly results: readonly ExampleResult[];
	readonly document_statuses: readonly DocumentationDocumentStatus[];
	readonly ignored_documents: number;
};

export type DocumentationDocumentStatus = {
	file_name: string;
	passed: boolean;
};

export type CallableDocumentationValidationOperation<T> = () => Promise<T>;

/** Responsibilities: _example lint integration_, _worker lifecycle_. **/
export interface DocumentationExampleLintContract {
	lint(
		repo_root: string,
		source_path: string,
		rule_id: string,
		source_files: DocumentationExampleSourceFiles,
	): readonly ViolationContract[];
	with_worker<T>(operation: CallableDocumentationValidationOperation<T>): Promise<T>;
}
