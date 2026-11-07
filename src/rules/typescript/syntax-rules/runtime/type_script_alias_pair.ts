import { TypeScriptInheritedAliasPairs } from "src/rules/typescript/syntax-rules/runtime/type_script_inherited_alias_pairs";
import ts from "typescript";

/** Responsibilities: _singular-plural field pairing_, _field type equivalence checks_. **/
export class TypeScriptAliasPair {
	private readonly _property_kinds: ReadonlySet<ts.SyntaxKind>;
	private readonly typed_field_error = "Typed field expected.";
	private readonly _inherited_pairs: TypeScriptInheritedAliasPairs;

	/** Responsibilities: _retrieval type node field_. **/
	private field_type(field_node: ts.Node): ts.TypeNode {
		if (!ts.isPropertyDeclaration(field_node) && !ts.isPropertySignature(field_node)) {
			throw new Error(this.typed_field_error);
		}
		if (field_node.type === undefined) {
			throw new Error(this.typed_field_error);
		}
		return field_node.type;
	}

	/** Responsibilities: _resolution textual name field_. **/
	private field_name(field_candidate: ts.Node): string {
		if (!this._property_kinds.has(field_candidate.kind)) {
			return "";
		}
		if (!ts.isPropertyDeclaration(field_candidate) && !ts.isPropertySignature(field_candidate)) {
			return "";
		}
		if (!ts.isIdentifier(field_candidate.name)) {
			return "";
		}
		return field_candidate.name.text;
	}

	/** Responsibilities: _retrieval sibling fields interface_. **/
	private sibling_fields(field_owner: ts.Node): readonly ts.Node[] {
		if (ts.isInterfaceDeclaration(field_owner) || ts.isClassLike(field_owner)) {
			return field_owner.members;
		}
		if (ts.isTypeLiteralNode(field_owner)) {
			return field_owner.members;
		}
		const parent = field_owner.parent;
		if (ts.isTypeLiteralNode(parent)) {
			return parent.members;
		}
		if (ts.isInterfaceDeclaration(parent)) {
			return parent.members;
		}
		if (ts.isClassLike(parent)) {
			return parent.members;
		}
		return [];
	}

	/** Responsibilities: _derivation singular plural aliases_. **/
	private alias_names(field_name: string): readonly string[] {
		let singular = field_name;
		if (field_name.endsWith("s")) {
			singular = field_name.slice(0, -1);
		}
		return [singular, `${singular}s`];
	}

	/** Responsibilities: _two-field classification_. **/
	private has_matching_types(fields: ReadonlyMap<string, ts.Node>, names: readonly string[]): boolean {
		const singular_name = names.at(0);
		const plural_name = names.at(1);
		if (singular_name === undefined || plural_name === undefined) {
			return false;
		}
		const singular_field = fields.get(singular_name);
		const plural_field = fields.get(plural_name);
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
	private named_fields(field_owner: ts.Node): ReadonlyMap<string, ts.Node> {
		const fields = new Map<string, ts.Node>();
		for (const field of this.sibling_fields(field_owner)) {
			if (ts.isPropertyDeclaration(field)) {
				const name = this.field_name(field);
				if (name.length > 0) {
					fields.set(name, field);
				}
				continue;
			}
			if (ts.isPropertySignature(field)) {
				const name = this.field_name(field);
				if (name.length > 0) {
					fields.set(name, field);
				}
			}
		}
		return fields;
	}

	/** Responsibilities: _field-kind policy ownership_. **/
	public constructor(property_kinds: ReadonlySet<ts.SyntaxKind>) {
		this._property_kinds = property_kinds;
		this._inherited_pairs = new TypeScriptInheritedAliasPairs(
			(owner) => this.named_fields(owner),
			(fields, names) => this.has_matching_types(fields, names),
		);
	}
	/** Responsibilities: _public operation_. **/
	public optional_field(optional_field_candidate: ts.Node): boolean {
		if (ts.isPropertyDeclaration(optional_field_candidate)) {
			if (optional_field_candidate.questionToken === undefined) {
				return false;
			}
			return optional_field_candidate.type !== undefined;
		}
		if (ts.isPropertySignature(optional_field_candidate)) {
			if (optional_field_candidate.questionToken === undefined) {
				return false;
			}
			return optional_field_candidate.type !== undefined;
		}
		return false;
	}

	/** Responsibilities: _reporting singular plural field_. **/
	public alias_pair(alias_candidate: ts.Node): boolean {
		if (ts.isInterfaceDeclaration(alias_candidate)) {
			return this._inherited_pairs.inherited_alias_pair(alias_candidate);
		}
		if (!this.optional_field(alias_candidate)) {
			return false;
		}
		const name = this.field_name(alias_candidate);
		if (name.length === 0) {
			return false;
		}
		return this.has_matching_types(this.named_fields(alias_candidate), this.alias_names(name));
	}
}
