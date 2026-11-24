import type {
	PythonExportNames,
	PythonReexportEdge,
	PythonReexportGraphContract,
	PythonReexportGraphOptions,
	PythonReexportTraversalContract,
	PythonResolvedImportBinding,
	UnusedSymbolAliasIndexContract,
	UnusedSymbolDefinitionLookupContract,
} from "src/contracts/protocols/global_analysis_protocols";
import type { UnusedDefinitionMatches } from "src/core/types";
import type { AstPythonImport } from "src/model/ast/normalized_ast_types";
import type { ProjectSourceScanContract } from "src/source_protocols";
import type { LintSourceRecordData } from "src/source_types";

/** Responsibilities: _Python re-export graph_, _source and export ownership_. **/
export class PythonReexportGraph implements PythonReexportGraphContract {
	private readonly _scanner: ProjectSourceScanContract;
	private readonly _available_files: Set<string>;
	private readonly _alias_index: UnusedSymbolAliasIndexContract;
	private readonly _definitions: UnusedSymbolDefinitionLookupContract;
	private readonly _sources_by_path: ReadonlyMap<string, LintSourceRecordData>;
	private readonly _exports_by_file: ReadonlyMap<string, PythonExportNames>;
	private readonly _imports: Map<string, PythonResolvedImportBinding[]>;

	/** Responsibilities: _source import binding resolution_. **/
	private source_imports(source: LintSourceRecordData): PythonResolvedImportBinding[] {
		const cached = this._imports.get(source.absolute_path);
		if (cached !== undefined) {
			return cached;
		}
		const bindings: PythonResolvedImportBinding[] = [];
		for (const item of source.normalized_ast.source.python_imports) {
			this.append_import_bindings(source.absolute_path, item, bindings);
		}
		this._imports.set(source.absolute_path, bindings);
		return bindings;
	}

	/** Responsibilities: _Python import binding construction_. **/
	private append_import_bindings(
		importing_file: string,
		item: AstPythonImport,
		bindings: PythonResolvedImportBinding[],
	): void {
		if (item.kind !== "from") {
			return;
		}
		const target_path = this._scanner.resolved_import_path(importing_file, item.module, this._available_files);
		const target = this._sources_by_path.get(target_path);
		if (target === undefined) {
			return;
		}
		for (const imported of item.names) {
			bindings.push({ target, imported });
		}
	}

	/** Responsibilities: _named import alias matching_. **/
	/** Responsibilities: _re-export edge name matching_. **/
	private edge_matches_symbol(edge: PythonReexportEdge, symbol_name: string): boolean {
		if (edge.imported.name === "*") {
			return this.exports_name(edge.target.absolute_path, symbol_name);
		}
		let local_name = edge.imported.name;
		if (edge.imported.alias.length > 0) {
			local_name = edge.imported.alias;
		}
		return this._alias_index.names(edge.source, symbol_name).includes(local_name);
	}

	/** Responsibilities: _re-export edge traversal_. **/
	private follow_edge(edge: PythonReexportEdge): UnusedDefinitionMatches {
		const symbol_name = edge.traversal.symbol_name();
		if (!this.edge_matches_symbol(edge, symbol_name)) {
			return [];
		}
		let imported_name = edge.imported.name;
		if (imported_name === "*") {
			imported_name = symbol_name;
		}
		const definitions = this._definitions.for_file(edge.target.absolute_path).exact(imported_name);
		if (definitions.length > 0) {
			return edge.traversal.unique_definitions(definitions);
		}
		return this.resolve(edge.traversal.fork(imported_name, edge.target));
	}

	/** Responsibilities: _re-export graph initialization_. **/
	public constructor(options: PythonReexportGraphOptions) {
		this._scanner = options.scanner;
		this._available_files = options.available_files;
		this._alias_index = options.alias_index;
		this._definitions = options.definitions;
		this._sources_by_path = options.sources_by_path;
		this._exports_by_file = options.exports_by_file;
		this._imports = new Map();
	}

	/** Responsibilities: _wildcard export membership_. **/
	public exports_name(file: string, name: string): boolean {
		const exports = this._exports_by_file.get(file);
		if (exports === undefined) {
			return false;
		}
		return exports.has(name);
	}

	/** Responsibilities: _Python re-export graph traversal_. **/
	public resolve(traversal: PythonReexportTraversalContract): UnusedDefinitionMatches {
		const source = traversal.source();
		if (source.language !== "python" || !traversal.enter()) {
			return [];
		}
		const matches: UnusedDefinitionMatches[] = [];
		const source_imports = this.source_imports(source);
		for (const binding of source_imports) {
			matches.push(this.follow_edge({ ...binding, source, traversal }));
		}
		return matches.flat();
	}
}
