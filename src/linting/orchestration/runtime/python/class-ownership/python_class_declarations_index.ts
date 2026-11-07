import type {
	PythonClassDeclarations,
	PythonClassDeclarationsIndexContract,
} from "src/linting/orchestration/runtime/python/protocols";
import type { LintSourceRecordData } from "src/source_types";

/** Responsibilities: _production class declarations_, _production protocol declarations_. **/
export class PythonClassDeclarationsIndex implements PythonClassDeclarationsIndexContract {
	private readonly _declarations_by_file: Map<string, PythonClassDeclarations>;

	/** Responsibilities: _source declaration collection_. **/
	private source_declarations(source: LintSourceRecordData): PythonClassDeclarations {
		const class_names = new Set<string>();
		const protocol_names = new Set<string>();
		for (const node of source.normalized_ast.source.classes) {
			if (node.classification.protocol) {
				protocol_names.add(node.identity.name);
				continue;
			}
			class_names.add(node.identity.name);
		}
		return { class_names, protocol_names };
	}

	/** Responsibilities: _empty declaration index_. **/
	public constructor() {
		this._declarations_by_file = new Map<string, PythonClassDeclarations>();
	}

	/** Responsibilities: _production declaration indexing_. **/
	public populate(sources: readonly LintSourceRecordData[]): void {
		for (const source of sources) {
			if (source.language !== "python" || source.file_name.test()) {
				continue;
			}
			this._declarations_by_file.set(source.absolute_path, this.source_declarations(source));
		}
	}

	/** Responsibilities: _declaration map access_. **/
	public values(): ReadonlyMap<string, PythonClassDeclarations> {
		return this._declarations_by_file;
	}

	/** Responsibilities: _indexed source paths_. **/
	public files(): readonly string[] {
		return [...this._declarations_by_file.keys()];
	}

	/** Responsibilities: _project source count_. **/
	public source_count(): number {
		return this._declarations_by_file.size;
	}
}
