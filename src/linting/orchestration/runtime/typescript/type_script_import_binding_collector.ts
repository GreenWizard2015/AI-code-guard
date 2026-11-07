import type { TypeScriptScannerOptions } from "src/model_types";
import type { TypeScriptModuleResolverContract } from "src/module-resolution/protocols";
import ts from "typescript";

/** Responsibilities: _project import binding collection_, _project import ownership resolution_. **/
export class TypeScriptImportBindingCollector {
	private readonly _module_resolver: TypeScriptModuleResolverContract;
	private readonly _project_files: ReadonlySet<string>;
	private readonly _module_path: string;
	private readonly _bindings: Set<string>;
	private readonly _external_bindings: Set<string>;
	private readonly _statement: ts.ImportDeclaration;

	/** Responsibilities: _project binding resolution_. **/
	private project_binding(name: string): boolean {
		if (this._module_path.length === 0) {
			return false;
		}
		const resolved = this._module_resolver.resolve({ file: this._module_path, name });
		if (resolved.file.length === 0) {
			return false;
		}
		return this._project_files.has(resolved.file);
	}

	/** Responsibilities: _default import collection_. **/
	private append_default_binding(name: ts.Identifier): void {
		if (this.project_binding("default")) {
			this._bindings.add(name.text);
		} else {
			this._external_bindings.add(name.text);
		}
	}

	/** Responsibilities: _named import collection_. **/
	private append_named_bindings(named: ts.NamedImportBindings): void {
		if (ts.isNamespaceImport(named)) {
			if (!this._project_files.has(this._module_path)) {
				this._external_bindings.add(named.name.text);
			}
			return;
		}
		for (const element of named.elements) {
			let imported_name = element.name.text;
			if (element.propertyName !== undefined) {
				imported_name = element.propertyName.text;
			}
			if (this.project_binding(imported_name)) {
				this._bindings.add(element.name.text);
			} else {
				this._external_bindings.add(element.name.text);
			}
		}
	}

	/** Responsibilities: _import binding initialization_. **/
	public constructor(statement: ts.ImportDeclaration, options: TypeScriptScannerOptions, module_path: string) {
		this._statement = statement;
		this._module_resolver = options.module_scope.module_resolver;
		this._project_files = options.module_scope.project_files;
		this._bindings = new Set();
		this._external_bindings = new Set();
		this._module_path = module_path;
	}

	/** Responsibilities: _project import resolution_. **/
	public collect(): void {
		const clause = this._statement.importClause;
		if (clause === undefined) {
			return;
		}
		if (clause.namedBindings !== undefined) {
			this.append_named_bindings(clause.namedBindings);
		}
		if (clause.name !== undefined) {
			this.append_default_binding(clause.name);
		}
	}

	/** Responsibilities: _import binding distribution_. **/
	public append_to(additions: Set<string>, exclusions: Set<string>): void {
		for (const binding of this._bindings) {
			additions.add(binding);
		}
		for (const binding of this._external_bindings) {
			exclusions.add(binding);
		}
	}
}
