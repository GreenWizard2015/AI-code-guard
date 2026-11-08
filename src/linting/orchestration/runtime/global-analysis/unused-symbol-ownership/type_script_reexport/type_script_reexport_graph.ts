import type {
	TypeScriptImportBindingIndexContract,
	TypeScriptReexportDefinitionCache,
	TypeScriptReexportGraphContract,
	TypeScriptReexportTarget,
	TypeScriptReexportWalkerContract,
} from "src/contracts/protocols/global_analysis_protocols";
import type { UnusedSymbolDefinition } from "src/core/types";
import { TypeScriptImportBindingIndex } from "src/linting/orchestration/runtime/global-analysis/unused-symbol-ownership/type_script_reexport/type_script_import_binding_index";
import { TypeScriptReexportWalker } from "src/linting/orchestration/runtime/global-analysis/unused-symbol-ownership/type_script_reexport/type_script_reexport_walker";
import type { ProjectSourceScanContract } from "src/source_protocols";
import type { LintSourceRecordData } from "src/source_types";

/** Responsibilities: _TypeScript import binding resolution_, _re-export definition caching_. **/
export class TypeScriptReexportGraph implements TypeScriptReexportGraphContract {
	private readonly _binding_index: TypeScriptImportBindingIndexContract;
	private readonly _walker: TypeScriptReexportWalkerContract;
	private readonly _definitions_by_source: TypeScriptReexportDefinitionCache;

	/** Responsibilities: _re-export lookup cache_. **/
	private resolve_target(target: TypeScriptReexportTarget): UnusedSymbolDefinition[] {
		let definitions_by_name = this._definitions_by_source.get(target.source.absolute_path);
		if (definitions_by_name === undefined) {
			definitions_by_name = new Map();
			this._definitions_by_source.set(target.source.absolute_path, definitions_by_name);
		}
		let definitions = definitions_by_name.get(target.name);
		if (definitions === undefined) {
			definitions = this._walker.resolve(target);
			definitions_by_name.set(target.name, definitions);
		}
		return definitions;
	}

	/** Responsibilities: _re-export graph initialization_. **/
	public constructor(
		scanner: ProjectSourceScanContract,
		available_files: Set<string>,
		sources_by_path: ReadonlyMap<string, LintSourceRecordData>,
		definitions_by_file: ReadonlyMap<string, readonly UnusedSymbolDefinition[]>,
	) {
		const import_index = new TypeScriptImportBindingIndex(scanner, available_files, sources_by_path);
		this._binding_index = import_index;
		this._walker = new TypeScriptReexportWalker(scanner, available_files, sources_by_path, definitions_by_file);
		this._definitions_by_source = new Map();
	}

	/** Responsibilities: _re-export cache invalidation_. **/
	public invalidate(): void {
		this._binding_index.invalidate();
		this._definitions_by_source.clear();
	}

	/** Responsibilities: _imported type resolution_. **/
	public resolve_import(importer_path: string, binding_name: string): UnusedSymbolDefinition[] {
		const targets = this._binding_index.targets(importer_path, binding_name);
		const definitions: UnusedSymbolDefinition[] = [];
		for (const target of targets) {
			definitions.push(...this.resolve_target(target));
		}
		return definitions;
	}
}
