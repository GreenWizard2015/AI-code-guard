import type ts from "typescript";
import type { LintSourceRecord } from "src/source_types";
import type { ClassGraph, ImportedSymbol } from "src/types";

/** Responsibilities: _composition component analysis contract_. **/
export interface CompositionComponentsContract {
	representative(component: readonly string[]): string;
	source_components(): string[][];
}

/** Responsibilities: _composition chain analysis contract_. **/
export interface CompositionChainContract {
	chain(key: string): string[];
	depth(key: string): number;
}

/** Responsibilities: _composition graph construction contract_. **/
export interface CompositionModelContract {
	class_graph(sources: readonly LintSourceRecord[]): ClassGraph;
}

/** Responsibilities: _Python export resolution_. **/
export interface PythonExportedSymbolResolverContract {
	resolve_exported_symbol(source_file: string, name: string): ImportedSymbol;
}

/** Responsibilities: _constructor dependency contract_. **/
export interface TypeScriptConstructorDependenciesContract {
	constructor_dependencies(node: ts.ClassLikeDeclaration): string[];
	collect_new_expressions(node: ts.Node): string[];
}
