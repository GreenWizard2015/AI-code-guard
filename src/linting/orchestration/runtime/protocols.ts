import type { ArraySourceResolver } from "src/analysis_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintSourceRecord } from "src/source_types";
import type { AstCallableReference, AstPythonImport, NormalizedAstFileContract } from "src/types";
import type { ImportedSymbol } from "src/model/types/types";
import type { PlacementFunctionNode } from "src/model/types/types";
import ts from "typescript";
import type { ArrayValuesVisitor } from "src/runtime_types";
import type { ObjectSourceVisitor } from "src/analysis_types";

/** Responsibilities: _define responsibility wording validation_. **/
export interface ResponsibilityWordingCheckerContract {
	valid(values: readonly string[]): boolean;
}

/** Responsibilities: _factory source contract_. **/
export interface FactoryObjectSourcesContract {
	values(): Map<string, ts.ObjectLiteralExpression>;
	append(expression: ts.Expression, visitor: ObjectSourceVisitor): void;
}

/** Responsibilities: _factory array source resolution_. **/
export interface TypeScriptFactoryArraySourcesContract {
	append(expression: ts.Expression, visitor: ArrayValuesVisitor): void;
	binding_elements(declaration: ts.VariableDeclaration): readonly ts.BindingElement[];
	values(declaration: ts.VariableDeclaration): readonly ts.Expression[];
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
	map_reference(
		reference: AstCallableReference,
		imports: ReadonlyMap<string, ImportedSymbol>,
		class_names: ReadonlySet<string>,
	): AstCallableReference;
	map_source(source: LintSourceRecord): NormalizedAstFileContract;
}

/** Responsibilities: _factory object binding sources_. **/
export interface TypeScriptFactoryObjectBindingSourcesContract {
	property_source(initializer: ts.ObjectLiteralExpression, property_name: string): string;
	source(
		initializer: ts.ObjectLiteralExpression,
		binding: ts.ObjectBindingPattern,
		name: string,
		array_source: ArraySourceResolver,
	): string;
}

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

/** Responsibilities: _Python re-export line classification_. **/
export interface ReexportNamesContract {
	implementation_line(line: string): boolean;
}

/** Responsibilities: _import fan-out diagnostics_. **/
export interface ImportFanOutContract {
	append_typescript(violations: ViolationContract[], file: string, source_file: ts.SourceFile): void;
	append_python(violations: ViolationContract[], file: string, ast: NormalizedAstFileContract): void;
}

/** Responsibilities: _function placement diagnostics_. **/
export interface FunctionPlacementRulesContract {
	append_module(violations: ViolationContract[], file: string, functions: readonly PlacementFunctionNode[]): void;
	append_domain(violations: ViolationContract[], file: string, functions: readonly PlacementFunctionNode[]): void;
	append_cli(violations: ViolationContract[], file: string, functions: readonly PlacementFunctionNode[]): void;
}

/** Responsibilities: _remaining reexport diagnostics_. **/
export interface ReexportsContract {
	append_reexport_violations(
		violations: ViolationContract[],
		file: string,
		text: string,
		source: LintSourceRecord,
	): void;
}

/** Responsibilities: _destructured object alias lookup_. **/
export interface ObjectDestructuredAliasesContract {
	contains(expression: ts.Expression, node: ts.Node): boolean;
	names(node: ts.Node): ReadonlySet<string>;
}

/** Responsibilities: _factory array object sources_. **/
export interface TypeScriptFactoryArrayObjectSourcesContract {
	source(binding: ts.ObjectBindingPattern, expression: ts.Expression, name: string): string;
	binding_source(binding: ts.ArrayBindingPattern, values: readonly ts.Expression[], name: string): string;
}
