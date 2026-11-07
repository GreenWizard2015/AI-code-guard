import type {
	FiniteVariantEnumIndexContract,
	FiniteVariantMembers,
} from "src/rules/typescript/syntax-rules/types/types";
import ts from "typescript";

/** Responsibilities: _static enum identity_, _alias-safe member collection_. **/
export class FiniteVariantEnumIndex implements FiniteVariantEnumIndexContract {
	private readonly _names: FiniteVariantMembers;
	private readonly _identities: Set<string>;

	/** Responsibilities: _implicit enum value resolution_. **/
	private implicit_identity(previous_identity: string): string {
		if (previous_identity.length === 0) {
			return "number:0";
		}
		if (!previous_identity.startsWith("number:")) {
			return "";
		}
		const previous_value = Number(previous_identity.slice("number:".length));
		return `number:${previous_value + 1}`;
	}

	/** Responsibilities: _explicit enum value resolution_. **/
	private explicit_identity(explicit_member: ts.EnumMember): string {
		if (explicit_member.initializer === undefined) {
			return "";
		}
		if (ts.isStringLiteral(explicit_member.initializer)) {
			return `string:${explicit_member.initializer.text}`;
		}
		if (ts.isNumericLiteral(explicit_member.initializer)) {
			return `number:${Number(explicit_member.initializer.text)}`;
		}
		return "";
	}

	/** Responsibilities: _enum member identity resolution_. **/
	private member_identity(identity_member: ts.EnumMember, previous_identity: string): string {
		if (identity_member.initializer === undefined) {
			return this.implicit_identity(previous_identity);
		}
		return this.explicit_identity(identity_member);
	}

	/** Responsibilities: _single enum member registration_. **/
	private append_member(candidate_member: ts.EnumMember, identity: string): boolean {
		if (!ts.isIdentifier(candidate_member.name) && !ts.isStringLiteral(candidate_member.name)) {
			return false;
		}
		if (identity.length === 0 || this._identities.has(identity)) {
			return false;
		}
		this._identities.add(identity);
		this._names.add(candidate_member.name.getText().replaceAll(/["']/gu, ""));
		return true;
	}

	/** Responsibilities: _enum index state initialization_. **/
	public constructor() {
		this._names = new Set();
		this._identities = new Set();
	}

	/** Responsibilities: _enum member collection_. **/
	public read(node: ts.EnumDeclaration): void {
		this._names.clear();
		this._identities.clear();
		let previous_identity = "";
		for (const member of node.members) {
			const identity = this.member_identity(member, previous_identity);
			if (!this.append_member(member, identity)) {
				this._names.clear();
				this._identities.clear();
				return;
			}
			previous_identity = identity;
		}
	}

	/** Responsibilities: _distinct enum runtime values_. **/
	public members(): FiniteVariantMembers {
		return new Set(this._names);
	}
}
