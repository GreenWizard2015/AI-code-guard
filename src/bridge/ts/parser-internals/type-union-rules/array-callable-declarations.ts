import ts from "typescript";

/** Responsibilities: _array callable declaration discovery_. **/
export class TypeScriptArrayCallableDeclarations {
	private readonly cache = new WeakMap<ts.SourceFile, Map<string, readonly ts.FunctionLikeDeclaration[]>>();

	/** Responsibilities: _function declaration matching_. **/
	private append_function(node: ts.Node, name: string, declarations: ts.FunctionLikeDeclaration[]): void {
		if (!ts.isFunctionDeclaration(node)) {
			return;
		}
		if (node.name?.text === name) {
			declarations.push(node);
		}
	}

	/** Responsibilities: _method declaration matching_. **/
	private append_methods(node: ts.Node, name: string, declarations: ts.FunctionLikeDeclaration[]): void {
		if (!ts.isClassLike(node)) {
			return;
		}
		for (const member of node.members) {
			if (!ts.isMethodDeclaration(member)) {
				continue;
			}
			if (member.name?.getText() === name) {
				declarations.push(member);
			}
		}
	}

	/** Responsibilities: _variable callable matching_. **/
	private append_variable(node: ts.Node, name: string, declarations: ts.FunctionLikeDeclaration[]): void {
		if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name)) {
			return;
		}
		if (node.name.text !== name) {
			return;
		}
		const initializer = node.initializer;
		if (initializer === undefined) {
			return;
		}
		if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) {
			declarations.push(initializer);
		}
	}

	/** Responsibilities: _nested callable traversal_. **/
	public collect_node(node: ts.Node, name: string, declarations: ts.FunctionLikeDeclaration[]): void {
		this.append_function(node, name, declarations);
		this.append_methods(node, name, declarations);
		this.append_variable(node, name, declarations);
		ts.forEachChild(node, (child) => this.collect_node(child, name, declarations));
	}

	/** Responsibilities: _callable declaration collection_. **/
	public collect(source_file: ts.SourceFile, name: string): readonly ts.FunctionLikeDeclaration[] {
		const cached_by_name = this.cache.get(source_file);
		if (cached_by_name !== undefined) {
			const cached = cached_by_name.get(name);
			if (cached !== undefined) {
				return cached;
			}
		}
		const declarations: ts.FunctionLikeDeclaration[] = [];
		this.collect_node(source_file, name, declarations);
		if (cached_by_name === undefined) {
			this.cache.set(source_file, new Map([[name, declarations]]));
		} else {
			cached_by_name.set(name, declarations);
		}
		return declarations;
	}
}
