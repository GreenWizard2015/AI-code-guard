import { TYPESCRIPT_LANGUAGE } from "src/constants";
import { TypeScriptModuleExportsContext } from "src/module-resolution/exports/type_script_module_exports_context";
import type { TypeScriptModuleExportsContract } from "src/module-resolution/types";
import type { ProjectSourceAnalysisOptions } from "src/project_analysis_types";
import { InheritedStateProjectGraph } from "src/rules/typescript/syntax-rules/ast/verifier/inherited-state/inherited_state_project_graph";
import { TypeScriptInheritedStateSymbolIndex } from "src/rules/typescript/syntax-rules/ast/verifier/inherited-state/type_script_inherited_state_symbol_index";
import type {
	InheritedStateCache,
	InheritedStateDeclaration,
	InheritedStateNodes,
	TypeScriptInheritedStateClassNamesContract,
} from "src/rules/typescript/syntax-rules/types";
import type { LintProjectContextContract } from "src/shared_services_protocols";
import ts from "typescript";

/** Responsibilities: _project declaration indexing_, _inherited state caching_. **/
export class TypeScriptInheritedStateClassNames implements TypeScriptInheritedStateClassNamesContract {
	private readonly _scope_cache: InheritedStateCache;
	private readonly _collection_mutators: ReadonlySet<string>;

	/** Responsibilities: _source declaration indexing_. **/
	private source_declaration_nodes(source_file: ts.SourceFile): ts.Node[] {
		const declarations: ts.Node[] = [];
		const visit = (node: ts.Node): void => {
			if (ts.isClassLike(node) || ts.isInterfaceDeclaration(node)) {
				declarations.push(node);
			}
			ts.forEachChild(node, visit);
		};
		visit(source_file);
		return declarations;
	}

	/** Responsibilities: _module export resolution_. **/
	private module_exports(root: string, context: LintProjectContextContract): TypeScriptModuleExportsContract {
		const source_files = new Map<string, ts.SourceFile>();
		for (const record of context.files()) {
			if (record.language === TYPESCRIPT_LANGUAGE) {
				source_files.set(record.absolute_path, record.typescript_ast.source_file_node());
			}
		}
		const exports_context = new TypeScriptModuleExportsContext(root, source_files, false, context.source_io());
		return exports_context.module_exports();
	}

	/** Responsibilities: _project state collector initialization_. **/
	public constructor(collection_mutators: ReadonlySet<string>) {
		this._scope_cache = new WeakMap();
		this._collection_mutators = collection_mutators;
	}

	/** Responsibilities: _project declaration records_. **/
	public declarations(scope: ProjectSourceAnalysisOptions): InheritedStateDeclaration[] {
		const symbol_index = new TypeScriptInheritedStateSymbolIndex(this.module_exports(scope.root, scope.context));
		const declarations: InheritedStateDeclaration[] = [];
		for (const record of scope.context.files()) {
			if (record.language !== TYPESCRIPT_LANGUAGE) {
				continue;
			}
			const source_file = record.typescript_ast.source_file_node();
			const source_module = symbol_index.source_module(source_file);
			const syntax_nodes = this.source_declaration_nodes(source_file);
			const file_records = symbol_index.declarations_for_file(
				record.normalized_ast.source.classes,
				syntax_nodes,
				source_module,
			);
			declarations.push(...file_records);
		}
		return declarations;
	}

	/** Responsibilities: _cached inherited state collection_. **/
	public collect(scope: ProjectSourceAnalysisOptions): InheritedStateNodes {
		const cached_names = this._scope_cache.get(scope);
		if (cached_names !== undefined) {
			return cached_names;
		}
		const declarations = this.declarations(scope);
		const graph = new InheritedStateProjectGraph(declarations, this._collection_mutators);
		const stateful_names = graph.direct_stateful_names();
		graph.inherited_state_nodes(stateful_names);
		this._scope_cache.set(scope, stateful_names);
		return stateful_names;
	}
}
