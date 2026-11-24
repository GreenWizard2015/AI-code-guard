import { VISIBILITY_MODIFIERS } from "src/constants";
import { TestPathKind } from "src/types";
import type { ClassFieldRuleState } from "src/types";
import ts from "typescript";

/** Responsibilities: _class member visibility policy_, _class field mutability policy_. **/
export class TypeScriptClassMemberPolicy {
	private readonly _node: ts.Node;
	private readonly _path_kinds: ReadonlySet<TestPathKind>;

	/** Responsibilities: _class member declaration check_. **/
	private is_class_member(): boolean {
		const member =
			ts.isMethodDeclaration(this._node) ||
			ts.isPropertyDeclaration(this._node) ||
			ts.isGetAccessor(this._node) ||
			ts.isSetAccessor(this._node);
		return member && (ts.isClassDeclaration(this._node.parent) || ts.isClassExpression(this._node.parent));
	}

	/** Responsibilities: _class member modifier lookup_. **/
	private modifiers(): readonly ts.Modifier[] {
		if (!ts.canHaveModifiers(this._node)) {
			return [];
		}
		const modifiers = ts.getModifiers(this._node);
		if (modifiers === undefined) {
			return [];
		}
		return modifiers;
	}

	/** Responsibilities: _class member policy initialization_. **/
	public constructor(node: ts.Node, path_kinds: ReadonlySet<TestPathKind>) {
		this._node = node;
		this._path_kinds = path_kinds;
	}

	/** Responsibilities: _class member visibility requirement_. **/
	public requires_explicit_visibility(): boolean {
		if (this._path_kinds.has(TestPathKind.TestFile) || !this.is_class_member()) {
			return false;
		}
		return !this.modifiers().some((modifier) => VISIBILITY_MODIFIERS.includes(modifier.kind));
	}

	/** Responsibilities: _class field mutability state_. **/
	public mutable(): boolean {
		if (this._path_kinds.has(TestPathKind.TestFile) || !ts.isPropertyDeclaration(this._node)) {
			return false;
		}
		return !this.modifiers().some((modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword);
	}

	/** Responsibilities: _class member policy state_. **/
	public state(): ClassFieldRuleState {
		return {
			requires_explicit_visibility: this.requires_explicit_visibility(),
			mutable: this.mutable(),
		};
	}
}
