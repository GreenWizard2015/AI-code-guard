import ts from "typescript";

import type { TypeScriptModuleExportsContract, TypeScriptModuleSymbolReference } from "src/module-resolution/types";
import type {
	TypeScriptInheritedMethodSearchContract,
	TypeScriptInheritedMethodSearchOptions,
} from "src/parser/references/identity/references/protocols";

/** Responsibilities: _inherited method search_, _class hierarchy resolution_. **/
export class TypeScriptInheritedMethodSearch implements TypeScriptInheritedMethodSearchContract {
	private readonly _file_name: string;
	private readonly _class_name: string;
	private readonly _method_name: string;
	private readonly _source_files: ReadonlyMap<string, ts.SourceFile>;
	private readonly _module_exports: TypeScriptModuleExportsContract;
	private readonly _seen: Set<string>;
	private readonly _method_kinds: ReadonlySet<ts.SyntaxKind>;

	/** Responsibilities: _method membership_. **/
	private declares_method(target_class: ts.ClassLikeDeclaration): boolean {
		for (const member of target_class.members) {
			if (!this._method_kinds.has(member.kind)) {
				continue;
			}
			if (member.name !== undefined && member.name.getText() === this._method_name) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _base class name extraction_. **/
	private base_names(base_class: ts.ClassLikeDeclaration): string[] {
		const heritage_clauses = base_class.heritageClauses;
		if (heritage_clauses === undefined) {
			return [];
		}
		return heritage_clauses.flatMap((clause) => {
			if (clause.token !== ts.SyntaxKind.ExtendsKeyword) {
				return [];
			}
			return clause.types.map((type) => {
				const qualified_name = type.expression.getText();
				return qualified_name.slice(qualified_name.lastIndexOf(".") + 1);
			});
		});
	}

	/** Responsibilities: _imported base resolution_. **/
	private imported_base_export(
		statement: ts.ImportDeclaration,
		imported_base_name: string,
	): TypeScriptModuleSymbolReference {
		const imported_name = this.imported_name(statement, imported_base_name);
		if (imported_name.length === 0 || !ts.isStringLiteral(statement.moduleSpecifier)) {
			return { file: "", name: "" };
		}
		const imported_file = this._module_exports.module_symbol(this._file_name, statement.moduleSpecifier.text);
		if (imported_file.length === 0) {
			return { file: "", name: "" };
		}
		return this._module_exports.resolve({ file: imported_file, name: imported_name });
	}

	/** Responsibilities: _named import binding resolution_. **/
	private named_import_name(clause: ts.ImportClause, requested_base_name: string): string {
		const bindings = clause.namedBindings;
		if (bindings === undefined || !ts.isNamedImports(bindings)) {
			return "";
		}
		const binding = bindings.elements.find((element) => element.name.text === requested_base_name);
		if (binding === undefined) {
			return "";
		}
		if (binding.propertyName !== undefined) {
			return binding.propertyName.text;
		}
		return binding.name.text;
	}

	/** Responsibilities: _base import name resolution_. **/
	private imported_name(statement: ts.ImportDeclaration, requested_base_name: string): string {
		const clause = statement.importClause;
		if (clause === undefined) {
			return "";
		}
		const default_binding = clause.name;
		if (default_binding !== undefined && default_binding.text === requested_base_name) {
			return "default";
		}
		return this.named_import_name(clause, requested_base_name);
	}

	/** Responsibilities: _base class export resolution_. **/
	private base_export(exported_base_name: string): TypeScriptModuleSymbolReference {
		const source_file = this._source_files.get(this._file_name);
		if (source_file === undefined) {
			return { file: "", name: "" };
		}
		for (const statement of source_file.statements) {
			if (ts.isClassLike(statement) && statement.name !== undefined && statement.name.text === exported_base_name) {
				return { file: this._file_name, name: exported_base_name };
			}
			if (ts.isImportDeclaration(statement)) {
				const imported = this.imported_base_export(statement, exported_base_name);
				if (imported.file.length > 0) {
					return imported;
				}
			}
		}
		return this._module_exports.resolve({ file: this._file_name, name: exported_base_name });
	}

	/** Responsibilities: _inherited base method lookup_. **/
	private base_method_file(derived_class: ts.ClassLikeDeclaration): string {
		for (const base_name of this.base_names(derived_class)) {
			const base = this.base_export(base_name);
			if (base.file.length === 0 || base.name.length === 0) {
				continue;
			}
			const found = new TypeScriptInheritedMethodSearch({
				file: base.file,
				class_name: base.name,
				method: this._method_name,
				source_files: this._source_files,
				module_exports: this._module_exports,
				seen: this._seen,
			});
			const inherited_file = found.file();
			if (inherited_file.length > 0) {
				return inherited_file;
			}
		}
		return "";
	}

	/** Responsibilities: _inherited method search_. **/
	private file_in_source(source_file: ts.SourceFile): string {
		for (const declaration of source_file.statements) {
			if (!ts.isClassLike(declaration)) {
				continue;
			}
			const name = declaration.name;
			if (name === undefined || name.text !== this._class_name) {
				continue;
			}
			if (this.declares_method(declaration)) {
				return this._file_name;
			}
			return this.base_method_file(declaration);
		}
		return "";
	}

	/** Responsibilities: _lookup initialization_. **/
	public constructor(options: TypeScriptInheritedMethodSearchOptions) {
		this._file_name = options.file;
		this._class_name = options.class_name;
		this._method_name = options.method;
		this._source_files = options.source_files;
		this._module_exports = options.module_exports;
		this._seen = options.seen;
		this._method_kinds = new Set([
			ts.SyntaxKind.MethodDeclaration,
			ts.SyntaxKind.GetAccessor,
			ts.SyntaxKind.SetAccessor,
		]);
	}

	/** Responsibilities: _inherited method search_. **/
	public file(): string {
		const identity = `${this._file_name}\u0000${this._class_name}\u0000${this._method_name}`;
		if (this._seen.has(identity)) {
			return "";
		}
		this._seen.add(identity);
		const source_file = this._source_files.get(this._file_name);
		if (source_file === undefined) {
			return "";
		}
		return this.file_in_source(source_file);
	}

	/** Responsibilities: _inherited method membership_. **/
	public contains(): boolean {
		return this.file().length > 0;
	}
}
