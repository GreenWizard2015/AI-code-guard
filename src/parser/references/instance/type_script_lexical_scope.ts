import ts from "typescript";
import type { TypeScriptLexicalScopeContract } from "src/model/protocols";

/** Responsibilities: _declaration scope resolution_, _assignment scope resolution_. **/
export class TypeScriptLexicalScope implements TypeScriptLexicalScopeContract {
	private readonly source_file: ts.SourceFile;
	private readonly function_scope_kinds: ReadonlySet<ts.SyntaxKind>;
	private readonly lexical_scope_kinds: ReadonlySet<ts.SyntaxKind>;
	private readonly declarations: Map<string, { node: ts.Node; scope: ts.Node }[]>;
	private readonly indexed_sources: WeakSet<ts.SourceFile>;

	/** Responsibilities: _nearest function scope_. **/
	private nearest_function_scope(node: ts.Node): ts.Node {
		let current: ts.Node | undefined = node;
		while (current !== undefined) {
			if (this.function_scope_kinds.has(current.kind)) {
				return current;
			}
			current = current.parent;
		}
		return this.source_file;
	}

	/** Responsibilities: _nearest lexical scope_. **/
	private nearest_lexical_scope(node: ts.Node): ts.Node {
		let current: ts.Node | undefined = node;
		while (current !== undefined) {
			if (this.lexical_scope_kinds.has(current.kind) || this.function_scope_kinds.has(current.kind)) {
				return current;
			}
			current = current.parent;
		}
		return this.source_file;
	}

	/** Responsibilities: _binding declaration storage_. **/
	private declaration_name(node: ts.Node): string {
		if (ts.isVariableDeclaration(node)) {
			if (ts.isIdentifier(node.name)) {
				return node.name.text;
			}
		}
		if (ts.isParameter(node)) {
			if (ts.isIdentifier(node.name)) {
				return node.name.text;
			}
		}
		return "";
	}

	/** Responsibilities: _binding declaration registration_. **/
	private register_declaration(node: ts.Node, name: string): void {
		let declarations = this.declarations.get(name);
		if (declarations === undefined) {
			declarations = [];
			this.declarations.set(name, declarations);
		}
		declarations.push({ node, scope: this.declaration_scope(node) });
	}

	/** Responsibilities: _binding declaration indexing_. **/
	private append_declaration(node: ts.Node): void {
		const name = this.declaration_name(node);
		if (name.length > 0) {
			this.register_declaration(node, name);
		}
		node.forEachChild((child) => this.append_declaration(child));
	}

	/** Responsibilities: _lazy declaration indexing_. **/
	private ensure_declarations(): void {
		if (this.indexed_sources.has(this.source_file)) {
			return;
		}
		this.append_declaration(this.source_file);
		this.indexed_sources.add(this.source_file);
	}

	/** Responsibilities: _prior binding detection_. **/
	private has_prior_declaration(name: string, scope: ts.Node, reference: ts.Node): boolean {
		const declarations = this.declarations.get(name);
		if (declarations === undefined) {
			return false;
		}
		const reference_start = reference.getStart(reference.getSourceFile());
		return declarations.some((entry) => {
			if (entry.scope !== scope) {
				return false;
			}
			return entry.node.getStart(entry.node.getSourceFile()) <= reference_start;
		});
	}

	/** Responsibilities: _scope resolver initialization_. **/
	public constructor(source_file: ts.SourceFile) {
		this.function_scope_kinds = new Set([
			ts.SyntaxKind.FunctionDeclaration,
			ts.SyntaxKind.MethodDeclaration,
			ts.SyntaxKind.ArrowFunction,
			ts.SyntaxKind.FunctionExpression,
			ts.SyntaxKind.Constructor,
		]);
		this.lexical_scope_kinds = new Set([
			ts.SyntaxKind.Block,
			ts.SyntaxKind.CaseBlock,
			ts.SyntaxKind.CatchClause,
			ts.SyntaxKind.ForStatement,
			ts.SyntaxKind.ForInStatement,
			ts.SyntaxKind.ForOfStatement,
			ts.SyntaxKind.ModuleBlock,
			ts.SyntaxKind.SourceFile,
		]);
		this.source_file = source_file;
		this.declarations = new Map<string, { node: ts.Node; scope: ts.Node }[]>();
		this.indexed_sources = new WeakSet<ts.SourceFile>();
	}

	/** Responsibilities: _declaration lexical scope_. **/
	public declaration_scope(node: ts.Node): ts.Node {
		if (ts.isParameter(node)) {
			return this.nearest_function_scope(node);
		}
		if (ts.isVariableDeclaration(node)) {
			if (ts.isCatchClause(node.parent)) {
				return node.parent;
			}
			const declaration_list = node.parent;
			if (ts.isVariableDeclarationList(declaration_list)) {
				if ((declaration_list.flags & ts.NodeFlags.BlockScoped) !== 0) {
					return this.nearest_lexical_scope(node);
				}
			}
		}
		return this.nearest_function_scope(node);
	}

	/** Responsibilities: _assignment binding scope_. **/
	public assignment_scope(node: ts.Node): ts.Node {
		this.ensure_declarations();
		if (!ts.isBinaryExpression(node)) {
			return this.declaration_scope(node);
		}
		if (!ts.isIdentifier(node.left)) {
			return this.declaration_scope(node);
		}
		for (const scope of this.scope_chain(node)) {
			if (this.has_prior_declaration(node.left.text, scope, node)) {
				return scope;
			}
		}
		return this.nearest_function_scope(node);
	}

	/** Responsibilities: _visible scope chain_. **/
	public scope_chain(node: ts.Node): readonly ts.Node[] {
		const scopes: ts.Node[] = [];
		let current: ts.Node | undefined = node;
		while (current !== undefined) {
			if (this.lexical_scope_kinds.has(current.kind) || this.function_scope_kinds.has(current.kind)) {
				scopes.push(current);
			}
			current = current.parent;
		}
		if (scopes.length === 0) {
			scopes.push(this.source_file);
		}
		return scopes;
	}
}
