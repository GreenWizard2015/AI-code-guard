import type { CompositionFrameContext } from "src/contracts/types/composition_types";
import type { ClassGraph, ImportedSymbol } from "src/model_types";
import type { LintSourceRecordData } from "src/source_types";
import type ts from "typescript";

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

/** Responsibilities: _composition traversal frame contract_. **/
export interface CompositionChainFrameContract {
	missing_class(): boolean;
	dependency(): string;
	pending_dependency(): boolean;
	cycle_bound_exceeded(frame_count: number, maximum: number): boolean;
	waiting_for(dependency: string): boolean;
	mark_active(active: Set<string>): void;
	advance_dependency(): void;
	consider_chain(successor: string, depth: number): void;
	clear_waiting(): void;
	wait_for(dependency: string): void;
	mark_cycle_dependent(): void;
	complete(
		context: CompositionFrameContext,
		memo_depths: Map<string, number>,
		memo_next_keys: Map<string, string>,
	): void;
	complete_missing(
		context: CompositionFrameContext,
		memo_depths: Map<string, number>,
		memo_next_keys: Map<string, string>,
	): void;
}

/** Responsibilities: _composition graph construction contract_. **/
export interface CompositionModelContract {
	class_graph(sources: readonly LintSourceRecordData[]): ClassGraph;
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
