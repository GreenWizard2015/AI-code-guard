import ts from 'typescript';

/** Responsibilities: _detection union contracts bypassed_. **/
export class UnionContractBypass {
	private readonly supported_kinds = new Set([ts.SyntaxKind.UnionType]);
	/** Responsibilities: _unwrap parenthesized type nodes_. **/
	private unparenthesized(node: ts.TypeNode): ts.TypeNode {
		let current = node;
		while (ts.isParenthesizedTypeNode(current)) {
			current = current.type;
		}
		return current;
	}

	/** Responsibilities: _resolution referenced type name_. **/
	private reference_name(node: ts.TypeNode): string {
		node = this.unparenthesized(node);
		if (!ts.isTypeReferenceNode(node)) {
			return '';
		}
		const type_name = node.typeName;
		if (!ts.isIdentifier(type_name)) {
			return '';
		}
		return type_name.text;
	}

	/** Responsibilities: _classification intersection adds project_. **/
	private has_added_contract(node: ts.IntersectionTypeNode, name: string): boolean {
		if (!node.types.some(type => this.reference_name(type) === name)) {
			return false;
		}
		return node.types.some(type => ts.isTypeLiteralNode(type));
	}

	/** Responsibilities: _reporting node union containing_. **/
	public union(node: ts.Node): boolean {
		if (!this.supported_kinds.has(node.kind)) {
			return false;
		}
		return node.getChildCount() > 0;
	}

	/** Responsibilities: _reporting intersection bypasses union_. **/
	public bypass(node: ts.Node): boolean {
		if ((!this.union(node)) || (!ts.isUnionTypeNode(node)) || node.types.length !== 2) {
			return false;
		}
		const base = node.types.find(type => this.reference_name(type).length > 0);
		const branch = node.types
			.map(type => this.unparenthesized(type))
			.find(type => ts.isIntersectionTypeNode(type));
		if (base === undefined || branch === undefined) {
			return false;
		}
		const name = this.reference_name(base);
		return this.has_added_contract(branch, name);
	}
}
