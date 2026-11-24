import type { TypeScriptModuleSymbolReference } from "src/module-resolution/types";
import type { RuleContextContract } from "src/types";
import ts from "typescript";

/** Responsibilities: _imported collaborator symbol identity_, _local import aliases_. **/
export class TypeScriptCollaboratorImports {
	private readonly _source_file: ts.SourceFile;
	private readonly _context: RuleContextContract;
	private readonly _bindings: Map<string, TypeScriptModuleSymbolReference>;

	/** Responsibilities: _imported name resolution_. **/
	private imported_name(element: ts.ImportSpecifier): string {
		const property_name = element.propertyName;
		if (property_name !== undefined) {
			return property_name.text;
		}
		return element.name.text;
	}

	/** Responsibilities: _local import symbol registration_. **/
	private append_named_binding(element: ts.ImportSpecifier, module_path: string): void {
		const symbol = this._context.state().analysis.module_resolver.resolve({
			file: module_path,
			name: this.imported_name(element),
		});
		this._bindings.set(element.name.text, symbol);
	}

	/** Responsibilities: _named implementation import collection_. **/
	private append_named_imports(declaration: ts.ImportDeclaration): void {
		const clause = declaration.importClause;
		if (clause === undefined || clause.namedBindings === undefined) {
			return;
		}
		const bindings = clause.namedBindings;
		if (!ts.isNamedImports(bindings)) {
			return;
		}
		this.append_named_bindings(bindings, this.import_module(declaration));
	}

	/** Responsibilities: _imported module identity_. **/
	private import_module(declaration: ts.ImportDeclaration): string {
		const module_specifier = declaration.moduleSpecifier;
		if (!ts.isStringLiteral(module_specifier)) {
			return "";
		}
		return this._context
			.state()
			.analysis.module_resolver.module_symbol(this._source_file.fileName, module_specifier.text);
	}

	/** Responsibilities: _named symbol binding collection_. **/
	private append_named_bindings(bindings: ts.NamedImports, module_path: string): void {
		for (const element of bindings.elements) {
			this.append_named_binding(element, module_path);
		}
	}

	/** Responsibilities: _collaborator import index initialization_. **/
	public constructor(source_file: ts.SourceFile, context: RuleContextContract) {
		this._source_file = source_file;
		this._context = context;
		this._bindings = new Map();
	}

	/** Responsibilities: _collaborator import identity preparation_. **/
	public prepare(): void {
		this._bindings.clear();
		for (const statement of this._source_file.statements) {
			if (ts.isImportDeclaration(statement)) {
				this.append_named_imports(statement);
			}
		}
	}

	/** Responsibilities: _local collaborator symbol resolution_. **/
	public symbol(local_name: string): TypeScriptModuleSymbolReference {
		const symbol = this._bindings.get(local_name);
		if (symbol !== undefined) {
			return symbol;
		}
		return { file: "", name: "" };
	}

	/** Responsibilities: _local import iteration_. **/
	public named_symbols(): ReadonlyMap<string, TypeScriptModuleSymbolReference> {
		return this._bindings;
	}
}
