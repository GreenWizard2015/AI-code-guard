import type {
	TypeScriptCallableTypePropertiesContract,
	TypeScriptExpressionAliasesContract,
} from "src/typescript_runtime_protocols";
import type ts from "typescript";

/** Responsibilities: _scope analysis dependencies_. **/
export type TypeScriptObjectCallableScopeAnalysisOptions = {
	readonly root: ts.Node;
	readonly property_names: TypeScriptCallableTypePropertiesContract;
	readonly expression_aliases: TypeScriptExpressionAliasesContract;
};

/** Responsibilities: _typed object scope analysis_. **/
export interface TypeScriptObjectCallableScopeAnalysisContract {
	append(): boolean;
	names(): ReadonlySet<string>;
}

/** Responsibilities: _callable contract registration_. **/
export interface TypeScriptCallableTypeBindingsContract {
	append(node: ts.Node): boolean;
}
