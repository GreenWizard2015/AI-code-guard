import ts from "typescript";

/** Responsibilities: _detection singular plural field_. **/
export class TypeScriptAliasPair {
	private readonly property_kinds = new Set([ts.SyntaxKind.PropertyDeclaration, ts.SyntaxKind.PropertySignature]);

	/** Responsibilities: _retrieval type node field_. **/
	private field_type(node: ts.Node): ts.TypeNode {
		if (!ts.isPropertyDeclaration(node) && !ts.isPropertySignature(node)) {
			throw new Error("Typed field expected.");
		}
		if (node.type === undefined) {
			throw new Error("Typed field expected.");
		}
		return node.type;
	}

	/** Responsibilities: _resolution textual name field_. **/
	private field_name(node: ts.Node): string {
		if (!this.property_kinds.has(node.kind)) {
			return "";
		}
		if (!ts.isPropertyDeclaration(node) && !ts.isPropertySignature(node)) {
			return "";
		}
		if (!ts.isIdentifier(node.name)) {
			return "";
		}
		return node.name.text;
	}

	/** Responsibilities: _retrieval sibling fields interface_. **/
	private sibling_fields(node: ts.Node): readonly ts.Node[] {
		if (ts.isInterfaceDeclaration(node) || ts.isClassLike(node) || ts.isTypeLiteralNode(node)) {
			return node.members;
		}
		const parent = node.parent;
		if (ts.isTypeLiteralNode(parent)) {
			return parent.members;
		}
		if (ts.isInterfaceDeclaration(parent) || ts.isClassLike(parent)) {
			return parent.members;
		}
		return [];
	}

	/** Responsibilities: _derivation singular plural aliases_. **/
	private alias_names(name: string): readonly string[] {
		let singular = name;
		if (name.endsWith("s")) {
			singular = name.slice(0, -1);
		}
		return [singular, `${singular}s`];
	}

	/** Responsibilities: _two-field classification_. **/
	private has_matching_types(fields: ReadonlyMap<string, ts.Node>, names: readonly string[]): boolean {
		const singular_field = fields.get(names[0]);
		const plural_field = fields.get(names[1]);
		if (singular_field === undefined || plural_field === undefined) {
			return false;
		}
		if (!this.optional_fields(singular_field, plural_field)) {
			return false;
		}
		const singular_type = this.field_type(singular_field);
		const plural_type = this.field_type(plural_field);
		return this.matching_field_types(singular_type, plural_type);
	}

	/** Responsibilities: _classification both fields optional_. **/
	private optional_fields(singular: ts.Node, plural: ts.Node): boolean {
		if (!this.optional_field(singular)) {
			return false;
		}
		return this.optional_field(plural);
	}

	/** Responsibilities: _singular plural field comparison_. **/
	private matching_field_types(singular: ts.TypeNode, plural: ts.TypeNode): boolean {
		if (!ts.isArrayTypeNode(plural)) {
			return false;
		}
		return singular.getText() === plural.elementType.getText();
	}

	/** Responsibilities: _indexing sibling fields their_. **/
	private named_fields(node: ts.Node): ReadonlyMap<string, ts.Node> {
		const fields = new Map<string, ts.Node>();
		for (const field of this.sibling_fields(node)) {
			if (ts.isPropertyDeclaration(field) || ts.isPropertySignature(field)) {
				const name = this.field_name(field);
				if (name.length > 0) {
					fields.set(name, field);
				}
			}
		}
		return fields;
	}

	/** Responsibilities: _interface heritage type retrieval_. **/
	private heritage_types(node: ts.InterfaceDeclaration): readonly ts.ExpressionWithTypeArguments[] {
		if (node.heritageClauses === undefined) {
			return [];
		}
		for (const clause of node.heritageClauses) {
			if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
				return clause.types;
			}
		}
		return [];
	}

	/** Responsibilities: _named interface resolution_. **/
	private named_interfaces(source: ts.SourceFile, name: string): readonly ts.InterfaceDeclaration[] {
		const matches: ts.InterfaceDeclaration[] = [];
		const visit = (node: ts.Node): void => {
			if (ts.isInterfaceDeclaration(node) && node.name.text === name) {
				matches.push(node);
			}
			ts.forEachChild(node, visit);
		};
		visit(source);
		return matches;
	}

	/** Responsibilities: _inherited parent fields addition_. **/
	private append_inherited_parent(
		fields: Map<string, ts.Node>,
		parent: ts.InterfaceDeclaration,
		seen: Set<string>,
	): void {
		for (const [name, field] of this.named_fields(parent)) {
			fields.set(name, field);
		}
		for (const [name, field] of this.inherited_fields(parent, seen)) {
			fields.set(name, field);
		}
	}

	/** Responsibilities: _inherited interface fields collection_. **/
	private inherited_fields(node: ts.InterfaceDeclaration, seen: Set<string>): ReadonlyMap<string, ts.Node> {
		const fields = new Map<string, ts.Node>();
		if (seen.has(node.name.text)) {
			return fields;
		}
		seen.add(node.name.text);
		for (const heritage of this.heritage_types(node)) {
			if (!ts.isIdentifier(heritage.expression)) {
				continue;
			}
			for (const parent of this.named_interfaces(node.getSourceFile(), heritage.expression.text)) {
				this.append_inherited_parent(fields, parent, seen);
			}
		}
		return fields;
	}

	/** Responsibilities: _inherited alias pair detection_. **/
	private inherited_alias_pair(node: ts.InterfaceDeclaration): boolean {
		const fields = this.inherited_fields(node, new Set<string>());
		for (const name of fields.keys()) {
			if (this.has_matching_types(fields, this.alias_names(name))) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _reporting optional singular plural_. **/
	public optional_field(node: ts.Node): boolean {
		if (!ts.isPropertyDeclaration(node) && !ts.isPropertySignature(node)) {
			return false;
		}
		return node.questionToken !== undefined && node.type !== undefined;
	}

	/** Responsibilities: _reporting singular plural field_. **/
	public alias_pair(node: ts.Node): boolean {
		if (ts.isInterfaceDeclaration(node)) {
			return this.inherited_alias_pair(node);
		}
		if (!this.optional_field(node)) {
			return false;
		}
		const name = this.field_name(node);
		if (name.length === 0) {
			return false;
		}
		return this.has_matching_types(this.named_fields(node), this.alias_names(name));
	}
}
