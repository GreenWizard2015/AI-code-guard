import type {
	FiniteVariantDiscriminatedUnionIndexContract,
	FiniteVariantLiteralFieldIndex,
	FiniteVariantLiteralFields,
	FiniteVariantMembers,
	FiniteVariantSourceIndex,
} from "src/rules/typescript/syntax-rules/types/types";
import ts from "typescript";

/** Responsibilities: _literal tag extraction_, _discriminated union resolution_. **/
export class FiniteVariantDiscriminatedUnionIndex implements FiniteVariantDiscriminatedUnionIndexContract {
	private readonly _literal_fields: FiniteVariantLiteralFieldIndex;

	/** Responsibilities: _literal tag property extraction_. **/
	private literal_properties(type_declaration: ts.Node): FiniteVariantLiteralFields {
		const properties = new Map<string, string>();
		if (!ts.isTypeLiteralNode(type_declaration) && !ts.isInterfaceDeclaration(type_declaration)) {
			return properties;
		}
		for (const member of type_declaration.members) {
			if (!ts.isPropertySignature(member)) {
				continue;
			}
			if (member.type === undefined || member.name === undefined) {
				continue;
			}
			if (!ts.isLiteralTypeNode(member.type) || !ts.isStringLiteral(member.type.literal)) {
				continue;
			}
			properties.set(member.name.getText().replaceAll(/["']/gu, ""), member.type.literal.text);
		}
		return properties;
	}

	/** Responsibilities: _union branch tag properties_. **/
	private branch_properties(union_member: ts.TypeNode): FiniteVariantLiteralFields {
		if (ts.isTypeLiteralNode(union_member)) {
			return this.literal_properties(union_member);
		}
		if (ts.isTypeReferenceNode(union_member) && ts.isIdentifier(union_member.typeName)) {
			const fields = this._literal_fields.get(union_member.typeName.text);
			if (fields !== undefined) {
				return fields;
			}
		}
		return new Map();
	}

	/** Responsibilities: _common literal tag candidates_. **/
	private candidate_names(branches: readonly FiniteVariantLiteralFields[]): Set<string> {
		const names = new Set<string>();
		let initialized = false;
		for (const branch of branches) {
			if (!initialized) {
				for (const name of branch.keys()) {
					names.add(name);
				}
				initialized = true;
				continue;
			}
			for (const name of names) {
				if (!branch.has(name)) {
					names.delete(name);
				}
			}
		}
		return names;
	}

	/** Responsibilities: _common discriminator value collection_. **/
	private append_branch_values(
		branch: FiniteVariantLiteralFields,
		candidates: Map<string, FiniteVariantMembers>,
	): void {
		for (const [name, value] of branch) {
			const values = candidates.get(name);
			if (values !== undefined) {
				values.add(value);
			}
		}
	}

	/** Responsibilities: _distinct discriminator values_. **/
	private candidate_values(branches: readonly FiniteVariantLiteralFields[]): Map<string, FiniteVariantMembers> {
		const candidates: Map<string, FiniteVariantMembers> = new Map();
		for (const name of this.candidate_names(branches)) {
			candidates.set(name, new Set());
		}
		for (const branch of branches) {
			this.append_branch_values(branch, candidates);
		}
		return candidates;
	}

	/** Responsibilities: _finite union branch resolution_. **/
	private union_branches(union_declaration: ts.Node): FiniteVariantLiteralFields[] {
		if (!ts.isTypeAliasDeclaration(union_declaration) || !ts.isUnionTypeNode(union_declaration.type)) {
			return [];
		}
		const branches = union_declaration.type.types.map((member) => this.branch_properties(member));
		for (const branch of branches) {
			if (branch.size === 0) {
				return [];
			}
		}
		return branches;
	}

	/** Responsibilities: _single union discriminant registration_. **/
	private append_union(union_candidate: ts.Node, source_index: FiniteVariantSourceIndex): void {
		const branches = this.union_branches(union_candidate);
		if (branches.length < 2 || !ts.isTypeAliasDeclaration(union_candidate)) {
			return;
		}
		const candidates = this.candidate_values(branches);
		if (candidates.size !== 1) {
			return;
		}
		for (const [name, values] of candidates) {
			if (values.size !== branches.length) {
				return;
			}
			source_index.members.set(union_candidate.name.text, values);
			source_index.discriminants.set(union_candidate.name.text, name);
		}
	}

	/** Responsibilities: _index state initialization_. **/
	public constructor() {
		this._literal_fields = new Map();
	}

	/** Responsibilities: _source discriminator index reset_. **/
	public reset_source(): void {
		this._literal_fields.clear();
	}

	/** Responsibilities: _source literal declaration collection_. **/
	public append_literals(node: ts.Node): void {
		if (ts.isTypeAliasDeclaration(node) && ts.isTypeLiteralNode(node.type)) {
			this._literal_fields.set(node.name.text, this.literal_properties(node.type));
		}
		if (ts.isInterfaceDeclaration(node)) {
			this._literal_fields.set(node.name.text, this.literal_properties(node));
		}
	}

	/** Responsibilities: _source discriminated union collection_. **/
	public append_unions(union_declarations: readonly ts.TypeAliasDeclaration[], index: FiniteVariantSourceIndex): void {
		for (const declaration of union_declarations) {
			this.append_union(declaration, index);
		}
	}
}
