import type { NamedLine } from "src/model/ast/normalized_ast_types";
import ts from "typescript";

/** Responsibilities: _declaration name resolution_, _AST declaration-name caching_. **/
export class TypeScriptDeclarationNameIndex {
	private readonly _names: WeakMap<ts.Node, ts.Node>;

	/** Responsibilities: _optional declaration name_. **/
	private optional_name(declaration: ts.NamedDeclaration): ts.Node {
		if (declaration.name !== undefined) {
			return declaration.name;
		}
		return declaration;
	}

	/** Responsibilities: _top-level declaration name_. **/
	private top_name(declaration_node: ts.Node): ts.Node {
		if (ts.isImportSpecifier(declaration_node) || ts.isNamespaceImport(declaration_node)) {
			return declaration_node.name;
		}
		if (ts.isImportClause(declaration_node)) {
			return this.optional_name(declaration_node);
		}
		if (ts.isFunctionDeclaration(declaration_node) || ts.isClassDeclaration(declaration_node)) {
			return this.optional_name(declaration_node);
		}
		if (ts.isInterfaceDeclaration(declaration_node)) {
			return declaration_node.name;
		}
		if (ts.isTypeAliasDeclaration(declaration_node) || ts.isEnumDeclaration(declaration_node)) {
			return declaration_node.name;
		}
		return declaration_node;
	}

	/** Responsibilities: _member declaration name_. **/
	private member_name(member: ts.Node): ts.Node {
		if (ts.isMethodDeclaration(member) || ts.isMethodSignature(member)) {
			return member.name;
		}
		if (ts.isPropertyDeclaration(member) || ts.isPropertySignature(member)) {
			return member.name;
		}
		if (ts.isParameter(member) || ts.isTypeParameterDeclaration(member)) {
			return member.name;
		}
		if (ts.isVariableDeclaration(member) || ts.isBindingElement(member) || ts.isPropertyAssignment(member)) {
			return member.name;
		}
		return member;
	}

	/** Responsibilities: _declaration name index initialization_. **/
	public constructor() {
		this._names = new WeakMap<ts.Node, ts.Node>();
	}

	/** Responsibilities: _declaration name lookup_. **/
	public name_node(candidate_node: ts.Node): ts.Node {
		const cached = this._names.get(candidate_node);
		if (cached !== undefined) {
			return cached;
		}
		const top_level = this.top_name(candidate_node);
		let name = top_level;
		if (top_level === candidate_node) {
			name = this.member_name(candidate_node);
		}
		this._names.set(candidate_node, name);
		return name;
	}

	/** Responsibilities: _declaration identifier classification_. **/
	public name_matches(declaration_node: ts.Node, identifier_node: ts.Node): boolean {
		return this.name_node(declaration_node) === identifier_node;
	}

	/** Responsibilities: _symbol reference classification_. **/
	public append_symbol_reference(candidate: ts.Node, line: number, references: NamedLine[]): void {
		if (!ts.isIdentifier(candidate)) {
			return;
		}
		if (this.name_matches(candidate.parent, candidate)) {
			return;
		}
		references.push({ name: candidate.text, line });
	}
}
