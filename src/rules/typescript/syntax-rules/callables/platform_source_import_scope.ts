import type { PlatformSourceImportScopeContract } from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _platform runtime imports_, _platform type imports_. **/
export class PlatformSourceImportScope implements PlatformSourceImportScopeContract {
	private readonly _runtime_names: Set<string>;
	private readonly _type_names: Set<string>;

	/** Responsibilities: _namespace import indexing_. **/
	private append_namespace_import(clause: ts.ImportClause, bindings: ts.NamespaceImport): void {
		this._type_names.add(bindings.name.text);
		if (!clause.isTypeOnly) {
			this._runtime_names.add(bindings.name.text);
		}
	}

	/** Responsibilities: _named import indexing_. **/
	private append_named_imports(clause: ts.ImportClause, bindings: ts.NamedImports): void {
		for (const element of bindings.elements) {
			this._type_names.add(element.name.text);
			if (!clause.isTypeOnly && !element.isTypeOnly) {
				this._runtime_names.add(element.name.text);
			}
		}
	}

	/** Responsibilities: _Node import collection_. **/
	private append_import(statement: ts.Statement): void {
		if (!ts.isImportDeclaration(statement)) {
			return;
		}
		if (!ts.isStringLiteral(statement.moduleSpecifier) || !statement.moduleSpecifier.text.startsWith("node:")) {
			return;
		}
		const clause = statement.importClause;
		if (clause === undefined || clause.namedBindings === undefined) {
			return;
		}
		if (ts.isNamespaceImport(clause.namedBindings)) {
			this.append_namespace_import(clause, clause.namedBindings);
			return;
		}
		this.append_named_imports(clause, clause.namedBindings);
	}

	/** Responsibilities: _adapter field import classification_. **/
	private adapter_field_matches(owner: ts.ClassLikeDeclaration, field_name: string): boolean {
		for (const member of owner.members) {
			if (!ts.isPropertyDeclaration(member) || !ts.isIdentifier(member.name)) {
				continue;
			}
			if (member.name.text !== field_name) {
				continue;
			}
			return this.node_api_type(member);
		}
		return false;
	}

	/** Responsibilities: _import scope initialization_. **/
	public constructor() {
		this._runtime_names = new Set<string>();
		this._type_names = new Set<string>();
	}

	/** Responsibilities: _platform source import indexing_. **/
	public index(source_file: ts.SourceFile): void {
		for (const statement of source_file.statements) {
			this.append_import(statement);
		}
	}

	/** Responsibilities: _platform API call classification_. **/
	public node_api_call(call: ts.CallExpression): boolean {
		const expression = call.expression;
		if (ts.isIdentifier(expression)) {
			return this._runtime_names.has(expression.text);
		}
		if (!ts.isPropertyAccessExpression(expression) || !ts.isIdentifier(expression.expression)) {
			return false;
		}
		return this._runtime_names.has(expression.expression.text);
	}

	/** Responsibilities: _platform adapter field classification_. **/
	public node_api_type(field: ts.PropertyDeclaration): boolean {
		if (field.type === undefined) {
			return false;
		}
		if (ts.isTypeQueryNode(field.type) && ts.isIdentifier(field.type.exprName)) {
			return this._type_names.has(field.type.exprName.text);
		}
		if (!ts.isTypeReferenceNode(field.type) || !ts.isIdentifier(field.type.typeName)) {
			return false;
		}
		return this._type_names.has(field.type.typeName.text);
	}

	/** Responsibilities: _platform adapter call classification_. **/
	public adapter_member(call: ts.CallExpression, field_name: string): boolean {
		let owner = call.parent;
		while (owner !== undefined && !ts.isClassLike(owner)) {
			owner = owner.parent;
		}
		if (owner === undefined || !ts.isClassLike(owner)) {
			return false;
		}
		return this.adapter_field_matches(owner, field_name);
	}
}
