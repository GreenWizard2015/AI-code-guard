import type { PythonExportedSymbolResolverContract } from "src/contracts/protocols/composition_protocols";
import { PythonClassDeclarationsIndex } from "src/linting/orchestration/runtime/python/class-ownership/python_class_declarations_index";
import type {
	PythonClassDeclarations,
	PythonClassOwnershipOptions,
	PythonClassOwnershipStateContract,
} from "src/linting/orchestration/runtime/python/protocols";
import type { PythonImportSessionContract } from "src/source_protocols";

/** Responsibilities: _Python class ownership_, _project import sessions_. **/
export class PythonClassOwnership implements PythonClassOwnershipStateContract {
	private readonly _declarations_by_file: ReadonlyMap<string, PythonClassDeclarations>;
	private readonly _empty_declarations: PythonClassDeclarations;
	private readonly _symbol_resolver: PythonExportedSymbolResolverContract;
	private readonly _import_session_value: PythonImportSessionContract;
	private readonly _sources_available: boolean;

	/** Responsibilities: _Python ownership index initialization_. **/
	public constructor(options: PythonClassOwnershipOptions) {
		const declarations_index = new PythonClassDeclarationsIndex();
		declarations_index.populate(options.sources);
		this._declarations_by_file = declarations_index.values();
		this._empty_declarations = { class_names: new Set<string>(), protocol_names: new Set<string>() };
		this._symbol_resolver = options.export_symbols;
		const declaration_files = declarations_index.files();
		this._import_session_value = options.project_imports.for_files(new Set(declaration_files));
		this._sources_available = declarations_index.source_count() > 0;
	}

	/** Responsibilities: _Python import resolution_. **/
	public import_session(): PythonImportSessionContract {
		return this._import_session_value;
	}

	/** Responsibilities: _Python exported symbol resolution_. **/
	public exported_symbols(): PythonExportedSymbolResolverContract {
		return this._symbol_resolver;
	}

	/** Responsibilities: _Python source availability_. **/
	public project_sources_available(): boolean {
		return this._sources_available;
	}

	/** Responsibilities: _Python class declarations_. **/
	public declarations(file: string): PythonClassDeclarations {
		const declarations = this._declarations_by_file.get(file);
		if (declarations !== undefined) {
			return declarations;
		}
		return this._empty_declarations;
	}
}
