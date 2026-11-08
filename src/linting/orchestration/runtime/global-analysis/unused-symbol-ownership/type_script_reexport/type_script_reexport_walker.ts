import type {
	TypeScriptReexportTarget,
	TypeScriptReexportTraversal,
	TypeScriptReexportWalkerContract,
} from "src/contracts/protocols/global_analysis_protocols";
import { UNUSED_SYMBOL_KIND, type UnusedSymbolDefinition } from "src/core/types";
import type { ProjectSourceScanContract } from "src/source_protocols";
import type { LintSourceRecordData } from "src/source_types";
import ts from "typescript";

/** Responsibilities: _export traversal_, _type definition lookup_. **/
export class TypeScriptReexportWalker implements TypeScriptReexportWalkerContract {
	private readonly _scanner: ProjectSourceScanContract;
	private readonly _available_files: Set<string>;
	private readonly _sources_by_path: ReadonlyMap<string, LintSourceRecordData>;
	private readonly _definitions_by_file: ReadonlyMap<string, readonly UnusedSymbolDefinition[]>;

	/** Responsibilities: _named export target collection_. **/
	private named_targets(
		clause: ts.NamedExports,
		module_source: LintSourceRecordData,
		exported_name: string,
	): TypeScriptReexportTarget[] {
		const targets: TypeScriptReexportTarget[] = [];
		for (const element of clause.elements) {
			if (element.name.text !== exported_name) {
				continue;
			}
			let source_name = element.name.text;
			if (element.propertyName !== undefined) {
				source_name = element.propertyName.text;
			}
			targets.push({ source: module_source, name: source_name });
		}
		return targets;
	}

	/** Responsibilities: _re-export source lookup_. **/
	private resolved_module_targets(
		statement: ts.ExportDeclaration,
		export_origin: TypeScriptReexportTarget,
	): TypeScriptReexportTarget[] {
		const specifier = statement.moduleSpecifier;
		if (specifier === undefined || !ts.isStringLiteral(specifier)) {
			return [];
		}
		const source_path = export_origin.source.absolute_path;
		const target_path = this._scanner.resolved_import_path(source_path, specifier.text, this._available_files);
		const module_source = this._sources_by_path.get(target_path);
		if (module_source === undefined) {
			return [];
		}
		return [{ source: module_source, name: export_origin.name }];
	}

	/** Responsibilities: _export target resolution_. **/
	private export_targets(
		statement: ts.ExportDeclaration,
		module_target: TypeScriptReexportTarget,
	): TypeScriptReexportTarget[] {
		const clause = statement.exportClause;
		if (clause === undefined) {
			return [module_target];
		}
		if (ts.isNamedExports(clause)) {
			return this.named_targets(clause, module_target.source, module_target.name);
		}
		return [];
	}

	/** Responsibilities: _module export traversal_. **/
	private module_targets(export_origin: TypeScriptReexportTarget): TypeScriptReexportTarget[] {
		const targets: TypeScriptReexportTarget[] = [];
		for (const statement of export_origin.source.typescript_ast.source_file_node().statements) {
			if (!ts.isExportDeclaration(statement)) {
				continue;
			}
			for (const module_target of this.resolved_module_targets(statement, export_origin)) {
				targets.push(...this.export_targets(statement, module_target));
			}
		}
		return targets;
	}

	/** Responsibilities: _local type definition collection_. **/
	private append_type_definitions(
		definition_target: TypeScriptReexportTarget,
		found_definitions: Map<string, UnusedSymbolDefinition>,
	): boolean {
		let found_type = false;
		const definitions = this._definitions_by_file.get(definition_target.source.absolute_path) ?? [];
		for (const definition of definitions) {
			if (definition.kind !== UNUSED_SYMBOL_KIND.Type || definition.name !== definition_target.name) {
				continue;
			}
			found_type = true;
			found_definitions.set(`${definition.file}\u0000${definition.line}\u0000${definition.name}`, definition);
		}
		return found_type;
	}

	/** Responsibilities: _re-export target state_. **/
	private visit_target(traversal_target: TypeScriptReexportTarget, traversal: TypeScriptReexportTraversal): void {
		const identity = `${traversal_target.source.absolute_path}\u0000${traversal_target.name}`;
		if (traversal.visited.has(identity)) {
			return;
		}
		traversal.visited.add(identity);
		if (this.append_type_definitions(traversal_target, traversal.found)) {
			return;
		}
		traversal.pending.push(...this.module_targets(traversal_target));
	}

	/** Responsibilities: _pending export target traversal_. **/
	private traverse(traversal: TypeScriptReexportTraversal): void {
		while (traversal.pending.length > 0) {
			const target = traversal.pending.pop();
			if (target !== undefined) {
				this.visit_target(target, traversal);
			}
		}
	}

	/** Responsibilities: _export graph initialization_. **/
	public constructor(
		scanner: ProjectSourceScanContract,
		available_files: Set<string>,
		sources_by_path: ReadonlyMap<string, LintSourceRecordData>,
		definitions_by_file: ReadonlyMap<string, readonly UnusedSymbolDefinition[]>,
	) {
		this._scanner = scanner;
		this._available_files = available_files;
		this._sources_by_path = sources_by_path;
		this._definitions_by_file = definitions_by_file;
	}

	/** Responsibilities: _re-export targets_. **/
	public resolve(query: TypeScriptReexportTarget): UnusedSymbolDefinition[] {
		const traversal: TypeScriptReexportTraversal = {
			pending: [query],
			visited: new Set<string>(),
			found: new Map<string, UnusedSymbolDefinition>(),
		};
		this.traverse(traversal);
		return [...traversal.found.values()];
	}
}
