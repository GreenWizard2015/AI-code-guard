import type { TypeScriptLexicalScopeContract } from "src/model/protocols";
import ts from "typescript";

/** Responsibilities: _declaration scope resolution_, _assignment scope resolution_. **/
export class TypeScriptLexicalScope implements TypeScriptLexicalScopeContract {
	private readonly _source_file: ts.SourceFile;
	private readonly _function_scope_kinds: ReadonlySet<ts.SyntaxKind>;
	private readonly _lexical_scope_kinds: ReadonlySet<ts.SyntaxKind>;
	private readonly _declarations: Map<string, { node: ts.Node; scope: ts.Node }[]>;
	private readonly _indexed_sources: WeakSet<ts.SourceFile>;

	/** Responsibilities: _nearest function scope_. **/
	private nearest_function_scope(function_scope_query: ts.Node): ts.Node {
		let current: ts.Node | undefined = function_scope_query;
		while (current !== undefined) {
			if (this._function_scope_kinds.has(current.kind)) {
				return current;
			}
			current = current.parent;
		}
		return this._source_file;
	}

	/** Responsibilities: _nearest lexical scope_. **/
	private nearest_lexical_scope(lexical_scope_query: ts.Node): ts.Node {
		let current: ts.Node | undefined = lexical_scope_query;
		while (current !== undefined) {
			if (this._lexical_scope_kinds.has(current.kind) || this._function_scope_kinds.has(current.kind)) {
				return current;
			}
			current = current.parent;
		}
		return this._source_file;
	}

	/** Responsibilities: _binding declaration storage_. **/
	private declaration_name(declaration: ts.Node): string {
		if (ts.isVariableDeclaration(declaration) && ts.isIdentifier(declaration.name)) {
			return declaration.name.text;
		}
		if (ts.isParameter(declaration) && ts.isIdentifier(declaration.name)) {
			return declaration.name.text;
		}
		return "";
	}

	/** Responsibilities: _binding declaration indexing_. **/
	private append_declaration(subtree: ts.Node): void {
		const name = this.declaration_name(subtree);
		if (name.length > 0) {
			let declarations = this._declarations.get(name);
			if (declarations === undefined) {
				declarations = [];
				this._declarations.set(name, declarations);
			}
			declarations.push({ node: subtree, scope: this.declaration_scope(subtree) });
		}
		subtree.forEachChild((child) => this.append_declaration(child));
	}

	/** Responsibilities: _lazy declaration indexing_. **/
	private ensure_declarations(): void {
		if (this._indexed_sources.has(this._source_file)) {
			return;
		}
		this.append_declaration(this._source_file);
		this._indexed_sources.add(this._source_file);
	}

	/** Responsibilities: _prior binding detection_. **/
	private has_prior_declaration(name: string, scope: ts.Node, reference: ts.Node): boolean {
		const declarations = this._declarations.get(name);
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
		this._function_scope_kinds = new Set([
			ts.SyntaxKind.FunctionDeclaration,
			ts.SyntaxKind.MethodDeclaration,
			ts.SyntaxKind.ArrowFunction,
			ts.SyntaxKind.FunctionExpression,
			ts.SyntaxKind.Constructor,
		]);
		this._lexical_scope_kinds = new Set([
			ts.SyntaxKind.Block,
			ts.SyntaxKind.CaseBlock,
			ts.SyntaxKind.CatchClause,
			ts.SyntaxKind.ForStatement,
			ts.SyntaxKind.ForInStatement,
			ts.SyntaxKind.ForOfStatement,
			ts.SyntaxKind.ModuleBlock,
			ts.SyntaxKind.SourceFile,
		]);
		this._source_file = source_file;
		this._declarations = new Map<string, { node: ts.Node; scope: ts.Node }[]>();
		this._indexed_sources = new WeakSet<ts.SourceFile>();
	}

	/** Responsibilities: _declaration lexical scope_. **/
	public declaration_scope(declaration: ts.Node): ts.Node {
		if (ts.isParameter(declaration)) {
			return this.nearest_function_scope(declaration);
		}
		if (ts.isVariableDeclaration(declaration)) {
			if (ts.isCatchClause(declaration.parent)) {
				return declaration.parent;
			}
			const declaration_list = declaration.parent;
			if (ts.isVariableDeclarationList(declaration_list)) {
				if ((declaration_list.flags & ts.NodeFlags.BlockScoped) !== 0) {
					return this.nearest_lexical_scope(declaration);
				}
			}
		}
		return this.nearest_function_scope(declaration);
	}

	/** Responsibilities: _assignment binding scope_. **/
	public assignment_scope(assignment: ts.Node): ts.Node {
		this.ensure_declarations();
		if (!ts.isBinaryExpression(assignment)) {
			return this.declaration_scope(assignment);
		}
		if (!ts.isIdentifier(assignment.left)) {
			return this.declaration_scope(assignment);
		}
		for (const scope of this.scope_chain(assignment)) {
			if (this.has_prior_declaration(assignment.left.text, scope, assignment)) {
				return scope;
			}
		}
		return this.nearest_function_scope(assignment);
	}

	/** Responsibilities: _visible scope chain_. **/
	public scope_chain(origin: ts.Node): readonly ts.Node[] {
		const scopes: ts.Node[] = [];
		let current: ts.Node | undefined = origin;
		while (current !== undefined) {
			if (this._lexical_scope_kinds.has(current.kind) || this._function_scope_kinds.has(current.kind)) {
				scopes.push(current);
			}
			current = current.parent;
		}
		if (scopes.length === 0) {
			scopes.push(this._source_file);
		}
		return scopes;
	}
}
