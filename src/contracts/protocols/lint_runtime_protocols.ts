import type { CallableArraySourceResolver } from "src/analysis_types";
import type { CallableObjectSourceVisitor } from "src/analysis_types";
import type { CallableExpressionVisitor } from "src/analysis_types";
import type { UnusedFieldOwner } from "src/core/types";
import type { SharedParameterTypeSource } from "src/metrics/types";
import type { AstPythonImport, NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import type { AstResponsibilityKind } from "src/model/ast/normalized_ast_types";
import type { ImportedSymbol } from "src/model_types";
import type { PlacementFunctionNode } from "src/model_types";
import type { RemainingViolationOptions } from "src/model_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { ExpressionNamesContract, ProjectAnalysisIdentityContract } from "src/runtime_protocols";
import type { CallableArrayValuesVisitor } from "src/runtime_types";
import type { LintSourceRecordData } from "src/source_types";
import type {
	TypeScriptFactoryArrayAliasesContract,
	TypeScriptFactoryObjectAliasesContract,
	TypeScriptFactoryObjectPropertiesContract,
} from "src/typescript_runtime_protocols";
import type { TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";
import type ts from "typescript";

/** Responsibilities: _recovered source AST_. **/

export interface RecoveredRuleAstFileContract {
	source_file_node(): ts.SourceFile;
	normalized(): NormalizedAstFile;
	reference_normalization(cached: NormalizedAstFile): NormalizedAstFile;
}

/** Responsibilities: _recovered rule context dependencies_. **/
export type RecoveredRuleContextInput = {
	readonly violations: ViolationContract[];
	readonly file: string;
	readonly ast_file: RecoveredRuleAstFileContract;
	readonly traversal: TypeScriptAstTraversalContract;
};

/** Responsibilities: _responsibility target contract_. **/
export type ResponsibilityTarget = {
	readonly kind: AstResponsibilityKind;
	readonly name: string;
	readonly line: number;
	readonly documentation: string;
};

/** Responsibilities: _typed receiver ownership lookup_. **/
export interface UnusedSymbolReceiverContract {
	type(source_file: ts.SourceFile, receiver: ts.Expression): string;
	known(source_file: ts.SourceFile, receiver: ts.Expression): boolean;
}

/** Responsibilities: _receiver type indexing_. **/
export interface UnusedReceiverTypeIndexContract {
	collect(source_file: ts.SourceFile): void;
	type(receiver_name: string): string;
}

/** Responsibilities: _unused field owner lookup_. **/
export interface UnusedFieldOwnershipIndexContract {
	owner_fields(
		requesting_file: string,
		owner: string,
		imported_files: ReadonlySet<string>,
	): readonly UnusedFieldOwner[];
	fields_named(name: string): readonly UnusedFieldOwner[];
}

/** Responsibilities: _file cache entry construction_. **/
export type FileAnalysisCacheEntryOptions = {
	readonly cache_directory: string;
	readonly context_hash: string;
	readonly file: string;
	readonly source_hash: string;
	readonly ignored: boolean;
	readonly analysis_identity: ProjectAnalysisIdentityContract;
};

/** Responsibilities: _file cache record identity_. **/
export type FileAnalysisCacheRecordIdentity = {
	readonly version: number;
	readonly context_hash: string;
	readonly source_file: string;
	readonly source_hash: string;
	readonly ignored: boolean;
	readonly cache_file: string;
};

/** Responsibilities: _define responsibility wording validation_. **/
export interface ResponsibilityWordingCheckerContract {
	valid(values: readonly string[]): boolean;
}

/** Responsibilities: _factory source contract_. **/
export interface FactoryObjectSourcesContract {
	values(): Map<string, ts.ObjectLiteralExpression>;
	append(expression: ts.Expression, visitor: CallableObjectSourceVisitor): void;
}

/** Responsibilities: _factory object property lookup_. **/
export interface TypeScriptFactoryObjectPropertyLookupContract {
	append_value(visitor: CallableExpressionVisitor): void;
	property_source(): string;
}

/** Responsibilities: _factory array source resolution_. **/
export type TypeScriptFactoryArrayBindingData = {
	readonly elements: readonly ts.BindingElement[];
	readonly values: readonly ts.Expression[];
};

/** Responsibilities: _factory array source resolution_. **/
export interface TypeScriptFactoryArraySourcesContract {
	append(expression: ts.Expression, visitor: CallableArrayValuesVisitor): void;
	binding_data(declaration: ts.VariableDeclaration): TypeScriptFactoryArrayBindingData;
	elements(initializer: ts.ArrayLiteralExpression): readonly ts.Expression[];
	binding_source(binding: ts.ArrayBindingPattern, values: readonly ts.Expression[], name: string): string;
}

/** Responsibilities: _Python composition import resolution_. **/
export interface PythonCompositionImportsContract {
	add_python_import(result: Map<string, ImportedSymbol>, file: string, item: AstPythonImport): void;
	python_imports(file: string, imports: AstPythonImport[]): Map<string, ImportedSymbol>;
}

/** Responsibilities: _Python callable reference mapping_. **/
export interface PythonCallableReferenceTargetMapperContract {
	map_source(source: LintSourceRecordData): NormalizedAstFile;
}

/** Responsibilities: _factory object binding sources_. **/
export interface TypeScriptFactoryObjectBindingSourcesContract {
	property_source(initializer: ts.ObjectLiteralExpression, property_name: string): string;
	source(
		initializer: ts.ObjectLiteralExpression,
		binding: ts.ObjectBindingPattern,
		name: string,
		array_source: CallableArraySourceResolver,
	): string;
}

/** Responsibilities: _one object binding resolution_. **/
export type TypeScriptFactoryObjectBindingResolutionOptions = {
	readonly initializer: ts.ObjectLiteralExpression;
	readonly binding: ts.ObjectBindingPattern;
	readonly name: string;
	readonly array_source: CallableArraySourceResolver;
	readonly expression_names: ExpressionNamesContract;
	readonly object_sources: FactoryObjectSourcesContract;
};

/** Responsibilities: _object binding source operations_. **/
export interface TypeScriptFactoryObjectBindingResolutionContract {
	resolve(): string;
	nested_binding_source(element: ts.BindingElement): string;
}

/** Responsibilities: _factory alias lookup options_. **/
export type TypeScriptFactoryAliasLookupOptions = {
	readonly name: string;
	readonly expression_names: ExpressionNamesContract;
	readonly object_aliases: TypeScriptFactoryObjectAliasesContract;
	readonly array_aliases: TypeScriptFactoryArrayAliasesContract;
};

/** Responsibilities: _factory nested object expressions_. **/
export interface TypeScriptFactoryNestedObjectExpressionsContract {
	expressions(
		initializer: ts.ObjectLiteralExpression,
		binding: ts.ObjectBindingPattern,
		name: string,
	): ReadonlyMap<string, ts.FunctionLikeDeclarationBase>;
	append(
		initializer: ts.ObjectLiteralExpression,
		binding: ts.ObjectBindingPattern,
		name: string,
		expressions: Map<string, ts.FunctionLikeDeclarationBase>,
	): void;
}

/** Responsibilities: _nested factory expression inputs_. **/
export type TypeScriptFactoryNestedObjectExpressionWalkOptions = {
	readonly initializer: ts.ObjectLiteralExpression;
	readonly binding: ts.ObjectBindingPattern;
	readonly name: string;
	readonly expressions: Map<string, ts.FunctionLikeDeclarationBase>;
	readonly object_sources: Map<string, ts.ObjectLiteralExpression>;
	readonly properties: TypeScriptFactoryObjectPropertiesContract;
	readonly array_aliases: TypeScriptFactoryArrayAliasesContract;
};

/** Responsibilities: _factory object binding context_. **/
export type TypeScriptFactoryObjectBindingOptions = {
	readonly binding: ts.ObjectBindingPattern;
	readonly initializer: ts.Expression;
	readonly name: string;
	readonly expression_names: ExpressionNamesContract;
	readonly object_sources: Map<string, ts.ObjectLiteralExpression>;
	readonly properties: TypeScriptFactoryObjectPropertiesContract;
};

/** Responsibilities: _nested factory expression traversal_. **/
export interface TypeScriptFactoryNestedObjectExpressionWalkContract {
	expressions(): ReadonlyMap<string, ts.FunctionLikeDeclarationBase>;
	append(): void;
}

/** Responsibilities: _import fan-out diagnostics_. **/
export interface ImportFanOutContract {
	append(violations: ViolationContract[], source: LintSourceRecordData): void;
}

/** Responsibilities: _function placement diagnostics_. **/
export interface FunctionPlacementRulesContract {
	append(violations: ViolationContract[], file: string, functions: readonly PlacementFunctionNode[]): void;
}

/** Responsibilities: _remaining reexport diagnostics_. **/
export interface ReexportsContract {
	append_reexport_violations(
		violations: ViolationContract[],
		file: string,
		text: string,
		source: LintSourceRecordData,
	): void;
}

/** Responsibilities: _remaining file text diagnostics_. **/
export interface FileRemainingTextRulesContract {
	append(options: RemainingViolationOptions): void;
}

/** Responsibilities: _shared-parameter type source indexing_. **/
export interface SharedParameterTypeSourceIndexContract {
	append(keys: Iterable<string>, type_source: SharedParameterTypeSource): void;
	entries(): ReadonlyMap<string, SharedParameterTypeSource>;
	clear(): void;
}

/** Responsibilities: _destructured object alias lookup_. **/
export interface ObjectDestructuredAliasesContract {
	contains(expression: ts.Expression, node: ts.Node): boolean;
	names(node: ts.Node): ReadonlySet<string>;
}

/** Responsibilities: _factory array object sources_. **/
export interface TypeScriptFactoryArrayObjectSourcesContract {
	source(binding: ts.ObjectBindingPattern, expression: ts.Expression): string;
	binding_source(binding: ts.ArrayBindingPattern, values: readonly ts.Expression[]): string;
}
