import type {
	PythonExportNames,
	PythonReexportEdge,
	PythonReexportGraphContract,
	PythonReexportGraphOptions,
	PythonReexportTraversalContract,
	UnusedSymbolAliasIndexContract,
	UnusedSymbolDefinitionLookupContract,
} from "src/contracts/protocols/global_analysis_protocols";
import type { UnusedDefinitionMatches } from "src/core/types";
import type { AstPythonImport, AstPythonImportName } from "src/model/ast/normalized_ast_types";
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

	/** Responsibilities: _named import binding resolution_. **/
	private named_import_matches(
		source: LintSourceRecordData,
		imported: AstPythonImportName,
		symbol_name: string,
	): boolean {
		let local_name = imported.name;
		if (imported.alias.length > 0) {
			local_name = imported.alias;
		}
		return this._alias_index.names(source, symbol_name).includes(local_name);
	}

	/** Responsibilities: _re-export edge traversal_. **/
	private follow_edge(edge: PythonReexportEdge): UnusedDefinitionMatches {
		const symbol_name = edge.traversal.symbol_name();
		let imported_name = edge.imported.name;
		if (imported_name === "*") {
			if (!this.exports_name(edge.target.absolute_path, symbol_name)) {
				return [];
			}
			imported_name = symbol_name;
		} else {
			if (!this.named_import_matches(edge.source, edge.imported, symbol_name)) {
				return [];
			}
		}
		const definitions = this._definitions.for_file(edge.target.absolute_path).exact(imported_name);
		if (definitions.length > 0) {
			return edge.traversal.unique_definitions(definitions);
		}
		return this.resolve(edge.traversal.fork(imported_name, edge.target));
	}

	/** Responsibilities: _module import resolution_. **/
	private imported_item_definitions(
		item: AstPythonImport,
		traversal: PythonReexportTraversalContract,
	): UnusedDefinitionMatches {
		if (item.kind !== "from") {
			return [];
		}
		const source = traversal.source();
		const target_path = this._scanner.resolved_import_path(source.absolute_path, item.module, this._available_files);
		const target = this._sources_by_path.get(target_path);
		if (target === undefined) {
			return [];
		}
		const matches: UnusedDefinitionMatches[] = [];
		for (const imported of item.names) {
			matches.push(this.follow_edge({ source, target, imported, traversal }));
		}
		return matches.flat();
	}

	/** Responsibilities: _re-export graph initialization_. **/
	public constructor(options: PythonReexportGraphOptions) {
		this._scanner = options.scanner;
		this._available_files = options.available_files;
		this._alias_index = options.alias_index;
		this._definitions = options.definitions;
		this._sources_by_path = options.sources_by_path;
		this._exports_by_file = options.exports_by_file;
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
		for (const item of source.normalized_ast.source.python_imports) {
			matches.push(this.imported_item_definitions(item, traversal));
		}
		return matches.flat();
	}
}
