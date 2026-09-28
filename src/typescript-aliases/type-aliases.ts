import ts from 'typescript';

/** Responsibilities: _collection local type aliases_. **/
export class TypeScriptTypeAliases {
	private readonly aliases = new Map<string, string>();
	private readonly keyword_type_kinds = new Set([
		ts.SyntaxKind.AnyKeyword,
		ts.SyntaxKind.UnknownKeyword,
		ts.SyntaxKind.ObjectKeyword,
	]);

	/** Responsibilities: _resolution type alias target_. **/
	private alias_target(statement: ts.Statement, source_file: ts.SourceFile): string {
		if (!ts.isTypeAliasDeclaration(statement)) {
			return '';
		}
		if (ts.isTypeReferenceNode(statement.type) || this.keyword_type_kinds.has(statement.type.kind)) {
			return statement.type.getText(source_file);
		}
		if (ts.isArrayTypeNode(statement.type)) {
			return statement.type.getText(source_file);
		}
		if (
			ts.isTypeOperatorNode(statement.type)
			&& statement.type.operator === ts.SyntaxKind.ReadonlyKeyword
		) {
			return statement.type.getText(source_file);
		}
		return '';
	}

	/** Responsibilities: _collection nested type aliases_. **/
	private collect_node(node: ts.Node, source_file: ts.SourceFile): void {
		if (ts.isTypeAliasDeclaration(node)) {
			const target = this.alias_target(node, source_file);
			if (target !== '') {
				this.aliases.set(node.name.text, target);
			}
		}
		node.forEachChild(child => this.collect_node(child, source_file));
	}

	/** Responsibilities: _collection aliases from source_. **/
	public collect(source_file: ts.SourceFile): void {
		this.aliases.clear();
		this.collect_node(source_file, source_file);
	}

	/** Responsibilities: _resolution aliases transitively_. **/
	public resolve(name: string): string {
		let current = name;
		const visited = new Set<string>();
		while (!visited.has(current)) {
			visited.add(current);
			const target = this.aliases.get(current);
			if (target === undefined) {
				return current;
			}
			current = target;
		}
		return current;
	}

}
