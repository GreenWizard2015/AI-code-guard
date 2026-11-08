import { ResolvedTypeScriptDeclarationKind } from "src/module-resolution/types";
import type { TypeScriptModuleSymbolReference } from "src/module-resolution/types";
import type { TypeScriptModuleExportsContract } from "src/module-resolution/types";
import type { SourceFileResolver } from "src/source_types";
import ts from "typescript";

/** Responsibilities: _imported base class state_, _override classification_. **/
export class InheritedMethodReplacement {
	private readonly _declaration: ts.ClassLikeDeclaration;
	private readonly _module_resolver: TypeScriptModuleExportsContract;
	private readonly _source_resolver: SourceFileResolver;
	private readonly _imported_class_names: Set<string>;
	private readonly _namespace_imports: Map<string, string>;

	/** Responsibilities: _project class import resolution_. **/
	private project_class(reference: TypeScriptModuleSymbolReference): boolean {
		if (reference.file.length === 0) {
			return false;
		}
		const resolved = this._module_resolver.resolve(reference);
		if (resolved.file.length === 0 || !this._source_resolver.has(resolved.file)) {
			return false;
		}
		return this._module_resolver.symbol_kind(resolved) === ResolvedTypeScriptDeclarationKind.Class;
	}

	/** Responsibilities: _imported base class matching_. **/
	private imported_class(expression: ts.Expression): boolean {
		if (ts.isIdentifier(expression)) {
			return this._imported_class_names.has(expression.text);
		}
		if (!ts.isPropertyAccessExpression(expression) || !ts.isIdentifier(expression.expression)) {
			return false;
		}
		const module_file = this._namespace_imports.get(expression.expression.text);
		if (module_file === undefined) {
			return false;
		}
		return this.project_class({ file: module_file, name: expression.name.text });
	}

	/** Responsibilities: _named class import registration_. **/
	private append_named_imports(module_file: string, bindings: ts.NamedImports): void {
		for (const element of bindings.elements) {
			const property_name = element.propertyName;
			let imported_name = element.name.text;
			if (property_name !== undefined) {
				imported_name = property_name.text;
			}
			if (this.project_class({ file: module_file, name: imported_name })) {
				this._imported_class_names.add(element.name.text);
			}
		}
	}

	/** Responsibilities: _import clause registration_. **/
	private append_import_clause(module_file: string, clause: ts.ImportClause): void {
		const default_name = clause.name;
		if (default_name !== undefined && this.project_class({ file: module_file, name: "default" })) {
			this._imported_class_names.add(default_name.text);
		}
		const bindings = clause.namedBindings;
		if (bindings === undefined) {
			return;
		}
		if (ts.isNamespaceImport(bindings)) {
			this._namespace_imports.set(bindings.name.text, module_file);
			return;
		}
		this.append_named_imports(module_file, bindings);
	}

	/** Responsibilities: _import declaration processing_. **/
	private append_import_names(statement: ts.ImportDeclaration): void {
		if (!ts.isStringLiteral(statement.moduleSpecifier)) {
			return;
		}
		const import_clause = statement.importClause;
		if (import_clause === undefined) {
			return;
		}
		const module_file = this._module_resolver.module_symbol(
			this._declaration.getSourceFile().fileName,
			statement.moduleSpecifier.text,
		);
		this.append_import_clause(module_file, import_clause);
	}

	/** Responsibilities: _inherited replacement state_. **/
	public constructor(
		declaration: ts.ClassLikeDeclaration,
		module_resolver: TypeScriptModuleExportsContract,
		source_resolver: SourceFileResolver,
	) {
		this._declaration = declaration;
		this._module_resolver = module_resolver;
		this._source_resolver = source_resolver;
		this._imported_class_names = new Set<string>();
		this._namespace_imports = new Map<string, string>();
	}

	/** Responsibilities: _source imported class names_. **/
	public collect_imported_names(): void {
		for (const statement of this._declaration.getSourceFile().statements) {
			if (ts.isImportDeclaration(statement)) {
				this.append_import_names(statement);
			}
		}
	}

	/** Responsibilities: _imported base class matching_. **/
	public extends_imported_class(): boolean {
		const clauses = this._declaration.heritageClauses;
		if (clauses === undefined) {
			return false;
		}
		return clauses.some((clause) => {
			if (clause.token !== ts.SyntaxKind.ExtendsKeyword) {
				return false;
			}
			return clause.types.some((type) => this.imported_class(type.expression));
		});
	}

	/** Responsibilities: _inherited callable override detection_. **/
	public overrides_member(): boolean {
		return this._declaration.members.some((member) => {
			const callable =
				ts.isMethodDeclaration(member) || ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member);
			if (!callable) {
				return false;
			}
			const modifiers = member.modifiers;
			if (modifiers === undefined) {
				return false;
			}
			return modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.OverrideKeyword);
		});
	}
}
