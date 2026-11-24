import type {
	TypeScriptImportBindingIndexContract,
	TypeScriptReexportImportCache,
	TypeScriptReexportImportTargets,
	TypeScriptReexportTarget,
} from "src/contracts/protocols/global_analysis_protocols";
import type { ProjectSourceScanContract } from "src/source_protocols";
import type { LintSourceRecordData } from "src/source_types";
import ts from "typescript";

/** Responsibilities: _TypeScript import binding indexing_, _import binding cache lifecycle_. **/
export class TypeScriptImportBindingIndex implements TypeScriptImportBindingIndexContract {
	private readonly _scanner: ProjectSourceScanContract;
	private readonly _available_files: Set<string>;
	private readonly _sources_by_path: ReadonlyMap<string, LintSourceRecordData>;
	private readonly _bindings_by_source: TypeScriptReexportImportCache;

	/** Responsibilities: _import clause binding collection_. **/
	private append_clause_bindings(
		clause: ts.ImportClause,
		module_source: LintSourceRecordData,
		bindings: Map<string, TypeScriptReexportTarget[]>,
	): void {
		if (clause.name !== undefined) {
			bindings.set(clause.name.text, [{ source: module_source, name: "default" }]);
		}
		const named_bindings = clause.namedBindings;
		if (named_bindings !== undefined && ts.isNamedImports(named_bindings)) {
			this.append_named_bindings(named_bindings, module_source, bindings);
		}
	}

	/** Responsibilities: _named import binding collection_. **/
	private append_named_bindings(
		named_bindings: ts.NamedImports,
		module_source: LintSourceRecordData,
		bindings: Map<string, TypeScriptReexportTarget[]>,
	): void {
		for (const element of named_bindings.elements) {
			let imported_name = element.name.text;
			if (element.propertyName !== undefined) {
				imported_name = element.propertyName.text;
			}
			let targets = bindings.get(element.name.text);
			if (targets === undefined) {
				targets = [];
				bindings.set(element.name.text, targets);
			}
			targets.push({ source: module_source, name: imported_name });
		}
	}

	/** Responsibilities: _source import bindings_. **/
	private import_bindings(importer: LintSourceRecordData): TypeScriptReexportImportTargets {
		const bindings = new Map<string, TypeScriptReexportTarget[]>();
		for (const statement of importer.typescript_ast.source_file_node().statements) {
			if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
				continue;
			}
			const target_path = this._scanner.resolved_import_path(
				importer.absolute_path,
				statement.moduleSpecifier.text,
				this._available_files,
			);
			const module_source = this._sources_by_path.get(target_path);
			const clause = statement.importClause;
			if (module_source === undefined || clause === undefined) {
				continue;
			}
			this.append_clause_bindings(clause, module_source, bindings);
		}
		return bindings;
	}

	/** Responsibilities: _import binding index initialization_. **/
	public constructor(
		scanner: ProjectSourceScanContract,
		available_files: Set<string>,
		sources_by_path: ReadonlyMap<string, LintSourceRecordData>,
	) {
		this._scanner = scanner;
		this._available_files = available_files;
		this._sources_by_path = sources_by_path;
		this._bindings_by_source = new Map();
	}

	/** Responsibilities: _import binding cache invalidation_. **/
	public invalidate(): void {
		this._bindings_by_source.clear();
	}

	/** Responsibilities: _imported binding targets_. **/
	public targets(importer_path: string, binding_name: string): readonly TypeScriptReexportTarget[] {
		const importer = this._sources_by_path.get(importer_path);
		if (importer === undefined) {
			return [];
		}
		const source_file = importer.typescript_ast.source_file_node();
		let bindings = this._bindings_by_source.get(source_file);
		if (bindings === undefined) {
			bindings = this.import_bindings(importer);
			this._bindings_by_source.set(source_file, bindings);
		}
		const targets = bindings.get(binding_name);
		if (targets === undefined) {
			return [];
		}
		return targets;
	}
}
