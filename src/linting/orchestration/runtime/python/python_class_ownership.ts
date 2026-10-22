import type { ProjectSourcePythonContract } from "src/source_protocols";
import type { LintSourceRecord } from "src/source_types";
import type { AstPythonImport, NormalizedAstFileContract } from "src/types";
import type { ImportedSymbol } from "src/model/types/types";
import type { PythonClassNameSet, PythonClassNamesByFile } from "src/model/types/types";
import type { PythonExportedSymbolResolverContract } from "src/linting/orchestration/runtime/composition/protocols";

/** Responsibilities: _project class resolution_, _protocol ownership resolution_. **/
export class PythonClassOwnership {
	private readonly root: string;
	private readonly files: Set<string>;
	private readonly classes: PythonClassNamesByFile;
	private readonly protocols: PythonClassNamesByFile;
	private readonly export_resolver: PythonExportedSymbolResolverContract;

	/** Responsibilities: _source class names_. **/
	private source_names(sources: readonly LintSourceRecord[], protocols: boolean): PythonClassNamesByFile {
		const result = new Map<string, PythonClassNameSet>();
		for (const source of sources) {
			const names = source.normalized_ast.classes
				.filter((node) => node.protocol === protocols)
				.map((node) => node.name);
			result.set(source.absolute_path, new Set(names));
		}
		return result;
	}

	/** Responsibilities: _import alias name_. **/
	private import_alias(item: AstPythonImport, base: string): string {
		const separator = base.indexOf(".");
		if (separator >= 0) {
			return this.qualified_import_alias(item, base, separator);
		}
		return this.direct_import_alias(item, base);
	}

	/** Responsibilities: _qualified import alias_. **/
	private qualified_import_alias(item: AstPythonImport, base: string, separator: number): string {
		const prefix = base.substring(0, separator);
		const imported_name = base.substring(base.lastIndexOf(".") + 1);
		for (const name of item.names) {
			let alias = name.alias;
			if (alias.length === 0) {
				alias = name.name;
			}
			if (alias !== prefix) {
				continue;
			}
			return imported_name;
		}
		return "";
	}

	/** Responsibilities: _direct import alias_. **/
	private direct_import_alias(item: AstPythonImport, base: string): string {
		for (const name of item.names) {
			let alias = name.alias;
			if (alias.length === 0) {
				alias = name.name;
			}
			if (alias === base) {
				return name.name;
			}
		}
		return "";
	}

	/** Responsibilities: _binding availability_. **/
	private available(binding: ImportedSymbol): boolean {
		if (binding.file.length === 0) {
			return false;
		}
		return binding.name.length > 0;
	}

	/** Responsibilities: _imported class binding_. **/
	private import_binding(
		file: string,
		ast: NormalizedAstFileContract,
		base: string,
		resolver: ProjectSourcePythonContract,
	): ImportedSymbol {
		for (const item of ast.python_imports) {
			const imported_file = resolver.python_import_path(this.root, file, item.module, this.files);
			if (imported_file.length === 0) {
				continue;
			}
			const imported_name = this.import_alias(item, base);
			if (imported_name.length === 0) {
				continue;
			}
			const exported = this.export_resolver.resolve_exported_symbol(imported_file, imported_name);
			if (exported.file.length > 0 && exported.name.length > 0) {
				return exported;
			}
			return { file: imported_file, name: imported_name };
		}
		return { file: "", name: "" };
	}

	/** Responsibilities: _class declaration membership_. **/
	private contains(names: ReadonlyMap<string, PythonClassNameSet>, file: string, name: string): boolean {
		const file_names = names.get(file);
		if (file_names === undefined) {
			return false;
		}
		return file_names.has(name);
	}

	/** Responsibilities: _project class binding_. **/
	private project_binding(
		file: string,
		ast: NormalizedAstFileContract,
		base: string,
		resolver: ProjectSourcePythonContract,
	): ImportedSymbol {
		if (this.contains(this.classes, file, base)) {
			return { file, name: base };
		}
		const imported = this.import_binding(file, ast, base, resolver);
		if (!this.available(imported)) {
			return { file: "", name: "" };
		}
		const imported_names = this.classes.get(imported.file);
		if (imported_names === undefined) {
			return { file: "", name: "" };
		}
		if (!imported_names.has(imported.name)) {
			return { file: "", name: "" };
		}
		return imported;
	}

	/** Responsibilities: _project protocol binding_. **/
	private project_protocol_binding(
		file: string,
		ast: NormalizedAstFileContract,
		base: string,
		resolver: ProjectSourcePythonContract,
	): ImportedSymbol {
		if (this.contains(this.protocols, file, base)) {
			return { file, name: base };
		}
		const imported = this.import_binding(file, ast, base, resolver);
		if (!this.available(imported) || !this.contains(this.protocols, imported.file, imported.name)) {
			return { file: "", name: "" };
		}
		return imported;
	}

	/** Responsibilities: _production source selection_. **/
	private production_sources(sources: readonly LintSourceRecord[]): LintSourceRecord[] {
		const result: LintSourceRecord[] = [];
		for (const source of sources) {
			if (!source.python()) {
				continue;
			}
			if (source.file_name.test()) {
				continue;
			}
			result.push(source);
		}
		return result;
	}

	/** Responsibilities: _ownership snapshot_. **/
	public constructor(root = "", export_resolver: PythonExportedSymbolResolverContract) {
		this.root = root;
		this.export_resolver = export_resolver;
		this.files = new Set<string>();
		this.classes = new Map<string, PythonClassNameSet>();
		this.protocols = new Map<string, PythonClassNameSet>();
	}

	/** Responsibilities: _ownership source loading_. **/
	public register_sources(sources: readonly LintSourceRecord[]): void {
		const production_sources = this.production_sources(sources);
		for (const source of production_sources) {
			this.files.add(source.absolute_path);
		}
		for (const [file, names] of this.source_names(production_sources, false)) {
			this.classes.set(file, names);
		}
		for (const [file, names] of this.source_names(production_sources, true)) {
			this.protocols.set(file, names);
		}
	}

	/** Responsibilities: _project class detection_. **/
	public project_class(
		file: string,
		ast: NormalizedAstFileContract,
		base: string,
		fallback: ReadonlySet<string>,
		resolver: ProjectSourcePythonContract,
	): boolean {
		if (this.files.size === 0) {
			return fallback.has(base);
		}
		return this.available(this.project_binding(file, ast, base, resolver));
	}

	/** Responsibilities: _project protocol detection_. **/
	public project_protocol(
		file: string,
		ast: NormalizedAstFileContract,
		base: string,
		fallback: ReadonlySet<string>,
		resolver: ProjectSourcePythonContract,
	): boolean {
		if (this.files.size === 0) {
			return fallback.has(base);
		}
		return this.available(this.project_protocol_binding(file, ast, base, resolver));
	}
}
