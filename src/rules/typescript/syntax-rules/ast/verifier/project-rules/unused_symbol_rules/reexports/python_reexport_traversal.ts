import type { PythonReexportTraversalContract } from "src/contracts/protocols/global_analysis_protocols";
import type { UnusedDefinitionMatches, UnusedSymbolDefinition } from "src/core/types";
import type { LintSourceRecordData } from "src/source_types";

/** Responsibilities: _Python re-export cycle tracking_, _imported symbol identity_. **/
export class PythonReexportTraversal implements PythonReexportTraversalContract {
	private readonly _name: string;
	private readonly _source_record: LintSourceRecordData;
	private readonly _visited_sources: Set<string>;
	private readonly _definition_keys: Set<string>;

	/** Responsibilities: _symbol traversal state_. **/
	public constructor(
		source: LintSourceRecordData,
		name: string,
		visited_sources: Set<string>,
		definition_keys: Set<string>,
	) {
		this._source_record = source;
		this._name = name;
		this._visited_sources = visited_sources;
		this._definition_keys = definition_keys;
	}

	/** Responsibilities: _imported symbol identity lookup_. **/
	public symbol_name(): string {
		return this._name;
	}

	/** Responsibilities: _current source lookup_. **/
	public source(): LintSourceRecordData {
		return this._source_record;
	}

	/** Responsibilities: _branch-specific import identity_. **/
	public fork(name: string, source: LintSourceRecordData): PythonReexportTraversalContract {
		return new PythonReexportTraversal(source, name, this._visited_sources, this._definition_keys);
	}

	/** Responsibilities: _source cycle detection_. **/
	public enter(): boolean {
		const key = `${this._source_record.absolute_path}\u0000${this._name}`;
		if (this._visited_sources.has(key)) {
			return false;
		}
		this._visited_sources.add(key);
		return true;
	}

	/** Responsibilities: _re-export definition deduplication_. **/
	public unique_definitions(definitions: UnusedDefinitionMatches): UnusedDefinitionMatches {
		const unique: UnusedSymbolDefinition[] = [];
		for (const definition of definitions) {
			const key = JSON.stringify([
				definition.file,
				definition.line,
				definition.kind,
				definition.owner,
				definition.name,
			]);
			if (this._definition_keys.has(key)) {
				continue;
			}
			this._definition_keys.add(key);
			unique.push(definition);
		}
		return unique;
	}
}
