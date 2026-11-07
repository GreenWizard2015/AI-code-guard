import type { CallableSourceImportScopeContract } from "src/analysis_protocols";
import { CallableSourceAnalysis } from "src/callable_source_analysis";
import { CODING_LINT_PATH_PREFIX } from "src/constants";
import type { CallableDefinition, ParsedFile } from "src/metrics/types";

/** Responsibilities: _project callable definitions_, _external base classification_. **/
export class CallableSourceProjectAnalysis {
	private readonly _sources: readonly CallableSourceAnalysis[];
	private readonly _source_import_scope: CallableSourceImportScopeContract;

	/** Responsibilities: _project source analysis initialization_. **/
	public constructor(parsed_files: readonly ParsedFile[], source_import_scope: CallableSourceImportScopeContract) {
		this._sources = parsed_files.map((file) => new CallableSourceAnalysis(file));
		this._source_import_scope = source_import_scope;
	}

	/** Responsibilities: _production inheritance classification_. **/
	public mark_external_bases(): ParsedFile[] {
		const classes_by_file = new Map<string, ReadonlySet<string>>();
		for (const source of this._sources) {
			const class_names = new Set<string>();
			for (const node of source._declarations.classes) {
				class_names.add(node.identity.name);
			}
			classes_by_file.set(source._file.absolute_file, class_names);
		}
		return this._sources.map((source) => source.with_external_bases(classes_by_file, this._source_import_scope));
	}

	/** Responsibilities: _project callable definitions_. **/
	public callable_definitions(): CallableDefinition[] {
		const definitions: CallableDefinition[] = [];
		for (const source of this._sources) {
			if (source._file.file.startsWith(CODING_LINT_PATH_PREFIX)) {
				continue;
			}
			definitions.push(...source.function_definitions());
			definitions.push(...source.method_definitions());
		}
		return definitions;
	}
}
