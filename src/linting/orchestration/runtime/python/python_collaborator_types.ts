import type {
	AstCallableReference,
	AstClassNode,
	AstPythonImport,
	AstStatementNode,
	NormalizedAstFile,
} from "src/model/ast/normalized_ast_types";
import type { ImportedSymbol } from "src/model_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { TestPathSyntaxContract } from "src/shared_services_protocols";
import type { PythonLintInput } from "src/types";

export type PythonMethodNames = ReadonlySet<string>;
export type PythonMethodMap = ReadonlyMap<string, PythonMethodNames>;

/** Responsibilities: _import identity_. **/
export type PythonCollaboratorImport = {
	readonly file: string;
	readonly name: string;
};

/** Responsibilities: _collaborator usage inputs_. **/
export type PythonCollaboratorUseOptions = {
	readonly start: number;
	readonly end: number;
	readonly statements: AstStatementNode[];
	readonly owner: string;
	readonly class_name: string;
	readonly local_name: string;
	readonly contracts: PythonMethodMap;
	readonly references: readonly AstCallableReference[];
	readonly imports: ReadonlyMap<string, PythonCollaboratorImport>;
};

/** Responsibilities: _Python import resolution_, _test file classification_. **/
export type PythonCollaboratorScannerOptions = {
	readonly source_asts: ReadonlyMap<string, NormalizedAstFile>;
	readonly import_resolver: PythonCompositionImportsContract;
	readonly test_path_syntax: TestPathSyntaxContract;
};

/** Responsibilities: _collaborator method identity_. **/
export type PythonCollaboratorMethodIdentity = {
	readonly name: string;
	readonly start: number;
	readonly end: number;
};

/** Responsibilities: _collaborator typed parameter name_. **/
export type PythonCollaboratorTypedParameter = {
	readonly name: string;
};

/** Responsibilities: _collaborator method signature inputs_. **/
export type PythonCollaboratorMethodSignature = {
	readonly statements: AstStatementNode[];
	readonly typed_arguments: readonly PythonCollaboratorTypedParameter[];
	readonly untyped_parameters: readonly string[];
};

/** Responsibilities: _Python collaborator method identity_, _method call inputs_. **/
export type PythonCollaboratorMethod = {
	readonly identity: PythonCollaboratorMethodIdentity;
	readonly signature: PythonCollaboratorMethodSignature;
};

/** Responsibilities: _method-level collaborator diagnostic inputs_. **/
export type PythonCollaboratorMethodAnalysisOptions = {
	readonly file_context: PythonCollaboratorFileContextContract;
	readonly method: PythonCollaboratorMethod;
	readonly class_node: AstClassNode;
	readonly collaborator_name: string;
	readonly local_name: string;
	readonly contracts: PythonMethodMap;
};

/** Responsibilities: _per-file collaborator analysis state_, _diagnostic accumulation_. **/
export interface PythonCollaboratorFileContextContract {
	input(): PythonLintInput;
	imports(): ReadonlyMap<string, ImportedSymbol>;
	module_variables(): ReadonlySet<string>;
	violations(): ViolationContract[];
	reported_lines(): Set<number>;
	classes(): readonly AstClassNode[];
	call_references(): readonly AstCallableReference[];
	prepare(): void;
}

/** Responsibilities: _Python import lookup_. **/
export interface PythonCompositionImportsContract {
	python_imports(file: string, imports: AstPythonImport[]): Map<string, ImportedSymbol>;
}
