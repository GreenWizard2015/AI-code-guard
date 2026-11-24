import type { JestScopeBindingMaps } from "src/model_types";
import type { JestExceptionFlagBindingsContract } from "src/testing_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _lexical scope indexing_, _exception flag assignment collection_, _catch-binding lookup_. **/
export class JestExceptionFlagBindings implements JestExceptionFlagBindingsContract {
	private readonly _declarations: JestScopeBindingMaps;
	private readonly _source_file: ts.SourceFile;
	private readonly _expect_aliases: TypeScriptExpressionAliasesContract;

	/** Responsibilities: _function scope identification_. **/
	private function_scope(callable_candidate: ts.Node): boolean {
		switch (callable_candidate.kind) {
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
	private scope_node(scope_candidate: ts.Node): boolean {
		if (this.function_scope(scope_candidate) || ts.isSourceFile(scope_candidate)) {
			return true;
		}
		switch (scope_candidate.kind) {
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
	private nearest_function_scope(lexical_start: ts.Node): ts.Node {
		let current: ts.Node | undefined = lexical_start;
		while (current !== undefined) {
			if (this.function_scope(current)) {
				return current;
			}
			if (ts.isSourceFile(current)) {
				return current;
			}
			current = current.parent;
		}
		return lexical_start.getSourceFile();
	}

	/** Responsibilities: _nearest lexical scope_. **/
	private nearest_lexical_scope(lexical_start: ts.Node): ts.Node {
		let current: ts.Node | undefined = lexical_start;
		while (current !== undefined && !this.scope_node(current)) {
			current = current.parent;
		}
		if (current === undefined) {
			return lexical_start.getSourceFile();
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
		let names = this._declarations.get(scope);
		if (names === undefined) {
			const created_names = new Map<string, ts.Declaration>();
			this._declarations.set(scope, created_names);
			names = created_names;
		}
		names.set(name.text, declaration);
	}

	/** Responsibilities: _scope declaration indexing_. **/
	private index(traversal_node: ts.Node): void {
		if (ts.isVariableDeclaration(traversal_node) || ts.isParameter(traversal_node)) {
			this.declare(traversal_node.name, traversal_node);
		}
		if (ts.isCatchClause(traversal_node) && traversal_node.variableDeclaration !== undefined) {
			this.declare(traversal_node.variableDeclaration.name, traversal_node.variableDeclaration);
		}
		ts.forEachChild(traversal_node, (child) => this.index(child));
	}

	/** Responsibilities: _identifier binding lookup_. **/
	private binding(identifier: ts.Identifier): ts.Node {
		let current: ts.Node | undefined = identifier.parent;
		while (current !== undefined) {
			const declarations = this._declarations.get(current);
			if (declarations === undefined) {
				current = current.parent;
				continue;
			}
			const declaration = declarations.get(identifier.text);
			if (declaration !== undefined) {
				return declaration;
			}
			current = current.parent;
		}
		return identifier;
	}

	/** Responsibilities: _exception flag assignment collection_. **/
	private append_boolean_assignment(assignment_candidate: ts.Node, flags: Set<ts.Node>): void {
		const candidate = assignment_candidate;
		if (!ts.isBinaryExpression(candidate) || candidate.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return;
		}
		if (!ts.isIdentifier(candidate.left)) {
			return;
		}
		const is_boolean =
			candidate.right.kind === ts.SyntaxKind.TrueKeyword || candidate.right.kind === ts.SyntaxKind.FalseKeyword;
		if (!is_boolean) {
			return;
		}
		const declaration = this.binding(candidate.left);
		if (declaration !== candidate.left) {
			flags.add(declaration);
		}
	}

	/** Responsibilities: _caught exception flag collection_. **/
	private append_catch_flags(search_root: ts.Node, flags: Set<ts.Node>): void {
		if (ts.isTryStatement(search_root) && search_root.catchClause !== undefined) {
			const visit = (child: ts.Node): void => {
				this.append_boolean_assignment(child, flags);
				ts.forEachChild(child, visit);
			};
			visit(search_root.catchClause);
		}
		ts.forEachChild(search_root, (child) => this.append_catch_flags(child, flags));
	}

	/** Responsibilities: _source declaration bindings_. **/
	public constructor(source_file: ts.SourceFile, expect_aliases: TypeScriptExpressionAliasesContract) {
		this._declarations = new WeakMap();
		this._source_file = source_file;
		this._expect_aliases = expect_aliases;
	}

	/** Responsibilities: _declaration index construction_. **/
	public index_declarations(): void {
		this.index(this._source_file);
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

	/** Responsibilities: _exception flag assertion matching_. **/
	public assertion_matches(node: ts.Node, flags: ReadonlySet<ts.Node>): boolean {
		if (!ts.isCallExpression(node)) {
			return false;
		}
		if (!ts.isIdentifier(node.expression)) {
			return false;
		}
		const value = node.arguments.at(0);
		if (value === undefined) {
			return false;
		}
		if (!ts.isIdentifier(value)) {
			return false;
		}
		if (!this._expect_aliases.receiver({ expression: node.expression, node })) {
			return false;
		}
		return this.exception_flag(value, flags);
	}
}
