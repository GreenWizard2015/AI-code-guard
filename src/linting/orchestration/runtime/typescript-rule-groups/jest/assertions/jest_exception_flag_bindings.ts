import ts from "typescript";
import type { JestScopeBindingMaps } from "src/model/types/types";
import type { JestExceptionFlagBindingsContract } from "src/testing_protocols";

/** Responsibilities: _lexical scope indexing_, _exception flag assignment collection_, _catch-binding lookup_. **/
export class JestExceptionFlagBindings implements JestExceptionFlagBindingsContract {
	private readonly declarations: JestScopeBindingMaps;
	private readonly source_file: ts.SourceFile;

	/** Responsibilities: _function scope identification_. **/
	private function_scope(node: ts.Node): boolean {
		switch (node.kind) {
			case ts.SyntaxKind.FunctionDeclaration:
			case ts.SyntaxKind.FunctionExpression:
			case ts.SyntaxKind.ArrowFunction:
			case ts.SyntaxKind.MethodDeclaration:
			case ts.SyntaxKind.Constructor:
			case ts.SyntaxKind.GetAccessor:
			case ts.SyntaxKind.SetAccessor:
				return true;
			default:
				return false;
		}
	}

	/** Responsibilities: _lexical scope identification_. **/
	private scope_node(node: ts.Node): boolean {
		if (this.function_scope(node) || ts.isSourceFile(node)) {
			return true;
		}
		switch (node.kind) {
			case ts.SyntaxKind.Block:
			case ts.SyntaxKind.CaseBlock:
			case ts.SyntaxKind.CatchClause:
			case ts.SyntaxKind.ForStatement:
			case ts.SyntaxKind.ForInStatement:
			case ts.SyntaxKind.ForOfStatement:
				return true;
			default:
				return false;
		}
	}

	/** Responsibilities: _nearest function scope_. **/
	private nearest_function_scope(node: ts.Node): ts.Node {
		let current: ts.Node | undefined = node;
		while (current !== undefined) {
			if (this.function_scope(current)) {
				return current;
			}
			if (ts.isSourceFile(current)) {
				return current;
			}
			current = current.parent;
		}
		return node.getSourceFile();
	}

	/** Responsibilities: _nearest lexical scope_. **/
	private nearest_lexical_scope(node: ts.Node): ts.Node {
		let current: ts.Node | undefined = node;
		while (current !== undefined && !this.scope_node(current)) {
			current = current.parent;
		}
		if (current === undefined) {
			return node.getSourceFile();
		}
		return current;
	}

	/** Responsibilities: _declaration scope resolution_. **/
	private declaration_scope(declaration: ts.Declaration): ts.Node {
		if (ts.isParameter(declaration)) {
			return this.nearest_function_scope(declaration.parent);
		}
		if (!ts.isVariableDeclaration(declaration)) {
			return declaration.getSourceFile();
		}
		const list = declaration.parent;
		if (!ts.isVariableDeclarationList(list)) {
			return declaration.getSourceFile();
		}
		if ((list.flags & ts.NodeFlags.BlockScoped) === 0) {
			return this.nearest_function_scope(list.parent);
		}
		if (ts.isForStatement(list.parent) || ts.isForInStatement(list.parent) || ts.isForOfStatement(list.parent)) {
			return list.parent;
		}
		return this.nearest_lexical_scope(list.parent);
	}

	/** Responsibilities: _lexical declaration registration_. **/
	private declare(name: ts.BindingName, declaration: ts.Declaration): void {
		if (!ts.isIdentifier(name)) {
			return;
		}
		const scope = this.declaration_scope(declaration);
		let names = this.declarations.get(scope);
		if (names === undefined) {
			const created_names = new Map<string, ts.Declaration>();
			this.declarations.set(scope, created_names);
			names = created_names;
		}
		names.set(name.text, declaration);
	}

	/** Responsibilities: _scope declaration indexing_. **/
	private index(node: ts.Node): void {
		if (ts.isVariableDeclaration(node) || ts.isParameter(node)) {
			this.declare(node.name, node);
		}
		if (ts.isCatchClause(node) && node.variableDeclaration !== undefined) {
			this.declare(node.variableDeclaration.name, node.variableDeclaration);
		}
		ts.forEachChild(node, (child) => this.index(child));
	}

	/** Responsibilities: _identifier binding lookup_. **/
	private binding(identifier: ts.Identifier): ts.Node {
		let current: ts.Node | undefined = identifier.parent;
		while (current !== undefined) {
			const declaration = this.declarations.get(current)?.get(identifier.text);
			if (declaration !== undefined) {
				return declaration;
			}
			current = current.parent;
		}
		return identifier;
	}

	/** Responsibilities: _exception flag assignment collection_. **/
	private append_boolean_assignment(node: ts.Node, flags: Set<ts.Node>): void {
		if (!ts.isBinaryExpression(node) || node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return;
		}
		if (!ts.isIdentifier(node.left)) {
			return;
		}
		const is_boolean = node.right.kind === ts.SyntaxKind.TrueKeyword || node.right.kind === ts.SyntaxKind.FalseKeyword;
		if (!is_boolean) {
			return;
		}
		const declaration = this.binding(node.left);
		if (declaration !== node.left) {
			flags.add(declaration);
		}
	}

	/** Responsibilities: _caught exception flag collection_. **/
	private append_catch_flags(node: ts.Node, flags: Set<ts.Node>): void {
		if (ts.isTryStatement(node) && node.catchClause !== undefined) {
			const visit = (child: ts.Node): void => {
				this.append_boolean_assignment(child, flags);
				ts.forEachChild(child, visit);
			};
			visit(node.catchClause);
		}
		ts.forEachChild(node, (child) => this.append_catch_flags(child, flags));
	}

	/** Responsibilities: _source declaration bindings_. **/
	public constructor(source_file: ts.SourceFile) {
		this.declarations = new WeakMap();
		this.source_file = source_file;
	}

	/** Responsibilities: _declaration index construction_. **/
	public index_declarations(): void {
		this.index(this.source_file);
	}

	/** Responsibilities: _callback exception flag indexing_. **/
	public exception_flags(callback: ts.ArrowFunction): ReadonlySet<ts.Node> {
		const flags = new Set<ts.Node>();
		this.append_catch_flags(callback.body, flags);
		return flags;
	}

	/** Responsibilities: _exception flag binding identification_. **/
	public exception_flag(identifier: ts.Identifier, flags: ReadonlySet<ts.Node>): boolean {
		const declaration = this.binding(identifier);
		return declaration !== identifier && flags.has(declaration);
	}
}
