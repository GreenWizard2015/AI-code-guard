import type {
	TypeScriptReexportTarget,
	TypeScriptReexportTraversal,
	UnusedSymbolDefinitionLookupContract,
} from "src/contracts/protocols/global_analysis_protocols";
import type { UnusedSymbolDefinition } from "src/core/types";
import { UNUSED_SYMBOL_KIND } from "src/core/types";
import type { ProjectSourceScanContract } from "src/source_protocols";
import type { LintSourceRecordData } from "src/source_types";
import ts from "typescript";

/** Responsibilities: _TypeScript re-export traversal_, _type definition resolution_. **/
export class TypeScriptReexportGraph {
	private readonly _scanner: ProjectSourceScanContract;
	private readonly _available_files: Set<string>;
	private readonly _definitions: UnusedSymbolDefinitionLookupContract;
	private readonly _sources_by_path: ReadonlyMap<string, LintSourceRecordData>;

	/** Responsibilities: _import clause target selection_. **/
	private import_clause_targets(
		clause: ts.ImportClause,
		import_target: TypeScriptReexportTarget,
	): TypeScriptReexportTarget[] {
		const targets: TypeScriptReexportTarget[] = [];
		if (clause.name?.text === import_target.name) {
			targets.push({ source: import_target.source, name: "default" });
		}
		const bindings = clause.namedBindings;
		if (bindings === undefined || !ts.isNamedImports(bindings)) {
			return targets;
		}
		for (const element of bindings.elements) {
			if (element.name.text === import_target.name) {
				targets.push({ source: import_target.source, name: element.propertyName?.text ?? element.name.text });
			}
		}
		return targets;
	}

	/** Responsibilities: _import declaration target lookup_. **/
	private import_targets(
		statement: ts.ImportDeclaration,
		import_target: TypeScriptReexportTarget,
	): TypeScriptReexportTarget[] {
		const targets: TypeScriptReexportTarget[] = [];
		const clause = statement.importClause;
		if (clause === undefined || !ts.isStringLiteral(statement.moduleSpecifier)) {
			return targets;
		}
		const target_path = this._scanner.resolved_import_path(
			import_target.source.absolute_path,
			statement.moduleSpecifier.text,
			this._available_files,
		);
		const module_source = this._sources_by_path.get(target_path);
		if (module_source === undefined) {
			return targets;
		}
		return this.import_clause_targets(clause, { source: module_source, name: import_target.name });
	}

	/** Responsibilities: _import target collection_. **/
	private imported_targets(importing_source: LintSourceRecordData, local_name: string): TypeScriptReexportTarget[] {
		const targets: TypeScriptReexportTarget[] = [];
		const import_target: TypeScriptReexportTarget = { source: importing_source, name: local_name };
		for (const statement of importing_source.typescript_ast.source_file_node().statements) {
			if (ts.isImportDeclaration(statement)) {
				targets.push(...this.import_targets(statement, import_target));
			}
		}
		return targets;
	}

	/** Responsibilities: _named export alias resolution_. **/
	private named_export_targets(
		clause: ts.NamedExports,
		module_target: TypeScriptReexportTarget,
	): TypeScriptReexportTarget[] {
		const targets: TypeScriptReexportTarget[] = [];
		for (const element of clause.elements) {
			if (element.name.text === module_target.name) {
				targets.push({
					source: module_target.source,
					name: element.propertyName?.text ?? element.name.text,
				});
			}
		}
		return targets;
	}

	/** Responsibilities: _export module target resolution_. **/
	private resolved_export_targets(
		exporting_source: LintSourceRecordData,
		module_specifier: string,
		exported_name: string,
	): TypeScriptReexportTarget[] {
		const target_path = this._scanner.resolved_import_path(
			exporting_source.absolute_path,
			module_specifier,
			this._available_files,
		);
		const module_source = this._sources_by_path.get(target_path);
		if (module_source === undefined) {
			return [];
		}
		return [{ source: module_source, name: exported_name }];
	}

	/** Responsibilities: _export clause target selection_. **/
	private export_clause_targets(
		statement: ts.ExportDeclaration,
		module_targets: TypeScriptReexportTarget[],
	): TypeScriptReexportTarget[] {
		const clause = statement.exportClause;
		if (clause === undefined) {
			return module_targets;
		}
		if (!ts.isNamedExports(clause)) {
			return [];
		}
		const targets: TypeScriptReexportTarget[] = [];
		for (const module_target of module_targets) {
			targets.push(...this.named_export_targets(clause, module_target));
		}
		return targets;
	}

	/** Responsibilities: _export declaration target resolution_. **/
	private export_declaration_targets(
		statement: ts.ExportDeclaration,
		exporting_target: TypeScriptReexportTarget,
	): TypeScriptReexportTarget[] {
		const module_specifier = statement.moduleSpecifier;
		if (module_specifier === undefined || !ts.isStringLiteral(module_specifier)) {
			return [];
		}
		const module_targets = this.resolved_export_targets(
			exporting_target.source,
			module_specifier.text,
			exporting_target.name,
		);
		return this.export_clause_targets(statement, module_targets);
	}

	/** Responsibilities: _type definition indexing_, _re-export continuation_. **/
	private append_type_definitions(target: TypeScriptReexportTarget, traversal: TypeScriptReexportTraversal): boolean {
		const definitions = this._definitions.for_file(target.source.absolute_path).exact(target.name);
		let found_type = false;
		for (const definition of definitions) {
			if (definition.kind === UNUSED_SYMBOL_KIND.Type) {
				found_type = true;
				const key = `${definition.file}\u0000${definition.line}\u0000${definition.name}`;
				traversal.found.set(key, definition);
			}
		}
		return found_type;
	}

	/** Responsibilities: _re-export node visitation_. **/
	private visit_target(target: TypeScriptReexportTarget, traversal: TypeScriptReexportTraversal): void {
		const identity = `${target.source.absolute_path}\u0000${target.name}`;
		if (traversal.visited.has(identity)) {
			return;
		}
		traversal.visited.add(identity);
		if (!this.append_type_definitions(target, traversal)) {
			for (const statement of target.source.typescript_ast.source_file_node().statements) {
				if (ts.isExportDeclaration(statement)) {
					traversal.pending.push(...this.export_declaration_targets(statement, target));
				}
			}
		}
	}

	/** Responsibilities: _re-export dependency setup_. **/
	public constructor(
		scanner: ProjectSourceScanContract,
		available_files: Set<string>,
		definitions: UnusedSymbolDefinitionLookupContract,
		sources_by_path: ReadonlyMap<string, LintSourceRecordData>,
	) {
		this._scanner = scanner;
		this._available_files = available_files;
		this._definitions = definitions;
		this._sources_by_path = sources_by_path;
	}

	/** Responsibilities: _type declaration resolution_. **/
	public definitions(exporting_source: LintSourceRecordData, name: string): UnusedSymbolDefinition[] {
		const traversal: TypeScriptReexportTraversal = {
			pending: [{ source: exporting_source, name }],
			visited: new Set<string>(),
			found: new Map<string, UnusedSymbolDefinition>(),
		};
		while (traversal.pending.length > 0) {
			const current = traversal.pending.pop();
			if (current === undefined) {
				continue;
			}
			this.visit_target(current, traversal);
		}
		return [...traversal.found.values()];
	}

	/** Responsibilities: _imported type declaration resolution_. **/
	public imported_definitions(importing_source: LintSourceRecordData, local_name: string): UnusedSymbolDefinition[] {
		const found = new Map<string, UnusedSymbolDefinition>();
		for (const imported of this.imported_targets(importing_source, local_name)) {
			for (const definition of this.definitions(imported.source, imported.name)) {
				const definition_key = `${definition.file}\u0000${definition.line}\u0000${definition.name}`;
				found.set(definition_key, definition);
			}
		}
		return [...found.values()];
	}
}
