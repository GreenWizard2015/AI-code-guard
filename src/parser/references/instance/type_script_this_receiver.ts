import { INSTANCE_PROPERTY_SIDE, STATIC_PROPERTY_SIDE } from "src/constants";
import type { TypeScriptPropertySide } from "src/types";
import ts from "typescript";

/** Responsibilities: _lexical this owner resolution_, _receiver property side classification_. **/
export class TypeScriptThisReceiver {
	private readonly _source_file: ts.SourceFile;
	private readonly _aliases: ReadonlyMap<string, string>;

	/** Responsibilities: _this parameter type extraction_. **/
	private this_parameter_type(signature: ts.SignatureDeclaration): string {
		for (const parameter of signature.parameters) {
			if (!ts.isIdentifier(parameter.name)) {
				continue;
			}
			if (parameter.name.text !== "this") {
				continue;
			}
			if (parameter.type === undefined) {
				continue;
			}
			if (ts.isTypeReferenceNode(parameter.type)) {
				return parameter.type.typeName.getText(this._source_file);
			}
		}
		return "";
	}

	/** Responsibilities: _receiver alias resolution_. **/
	private receiver_alias(name: string): string {
		const alias = this._aliases.get(name);
		if (alias === undefined) {
			return name;
		}
		return alias;
	}

	/** Responsibilities: _explicit receiver owner resolution_. **/
	private explicit_owner(owner_signature: ts.SignatureDeclaration): string {
		const name = this.this_parameter_type(owner_signature);
		if (name.length === 0) {
			return "";
		}
		const parts = name.split(".");
		const last_part = parts.at(-1);
		if (last_part === undefined) {
			return this.receiver_alias(name);
		}
		return this.receiver_alias(last_part);
	}

	/** Responsibilities: _class method classification_. **/
	private is_class_method(method_signature: ts.SignatureDeclaration): boolean {
		if (ts.isMethodDeclaration(method_signature)) {
			return true;
		}
		if (ts.isConstructorDeclaration(method_signature)) {
			return true;
		}
		if (ts.isGetAccessorDeclaration(method_signature)) {
			return true;
		}
		return ts.isSetAccessorDeclaration(method_signature);
	}

	/** Responsibilities: _function receiver resolution_. **/
	private function_owner(owner_candidate: ts.SignatureDeclaration): string {
		const explicit_owner = this.explicit_owner(owner_candidate);
		if (explicit_owner.length > 0) {
			return explicit_owner;
		}
		if (!this.is_class_method(owner_candidate)) {
			return "";
		}
		return this.class_owner(owner_candidate);
	}

	/** Responsibilities: _static member classification_. **/
	private member_side(member: ts.Node): TypeScriptPropertySide {
		if (!ts.canHaveModifiers(member)) {
			return INSTANCE_PROPERTY_SIDE;
		}
		const modifiers = ts.getModifiers(member);
		if (modifiers === undefined) {
			return INSTANCE_PROPERTY_SIDE;
		}
		if (modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword)) {
			return STATIC_PROPERTY_SIDE;
		}
		return INSTANCE_PROPERTY_SIDE;
	}

	/** Responsibilities: _receiver boundary resolution_. **/
	private boundary_owner(boundary: ts.Node): string {
		if (ts.isFunctionLike(boundary)) {
			return this.function_owner(boundary);
		}
		if (ts.isClassLike(boundary)) {
			if (boundary.name !== undefined) {
				return boundary.name.text;
			}
			return "";
		}
		return "";
	}

	/** Responsibilities: _member node classification_. **/
	private is_member_node(candidate: ts.Node): boolean {
		if (ts.isPropertyDeclaration(candidate)) {
			return true;
		}
		if (ts.isMethodDeclaration(candidate)) {
			return true;
		}
		if (ts.isGetAccessorDeclaration(candidate)) {
			return true;
		}
		return ts.isSetAccessorDeclaration(candidate);
	}

	/** Responsibilities: _enclosing member side lookup_. **/
	private enclosing_side(origin: ts.Node): TypeScriptPropertySide {
		let current: ts.Node | undefined = origin;
		while (current !== undefined) {
			if (ts.isClassLike(current)) {
				return INSTANCE_PROPERTY_SIDE;
			}
			if (this.is_member_node(current)) {
				return this.member_side(current);
			}
			current = current.parent;
		}
		return INSTANCE_PROPERTY_SIDE;
	}

	/** Responsibilities: _receiver source setup_. **/
	public constructor(source_file: ts.SourceFile, aliases: ReadonlyMap<string, string>) {
		this._source_file = source_file;
		this._aliases = aliases;
	}

	/** Responsibilities: _enclosing class owner lookup_. **/
	public class_owner(class_lookup: ts.Node): string {
		let current: ts.Node | undefined = class_lookup.parent;
		while (current !== undefined) {
			if (ts.isClassLike(current)) {
				if (current.name !== undefined) {
					return current.name.text;
				}
				return "";
			}
			current = current.parent;
		}
		return "";
	}

	/** Responsibilities: _this receiver static-instance side_. **/
	public side(expression: ts.Expression): TypeScriptPropertySide {
		if (expression.kind !== ts.SyntaxKind.ThisKeyword) {
			return INSTANCE_PROPERTY_SIDE;
		}
		return this.enclosing_side(expression.parent);
	}

	/** Responsibilities: _this expression owner lookup_. **/
	public owner(expression: ts.Expression): string {
		let current: ts.Node | undefined = expression.parent;
		while (current !== undefined) {
			if (ts.isArrowFunction(current)) {
				current = current.parent;
				continue;
			}
			if (ts.isFunctionLike(current)) {
				return this.boundary_owner(current);
			}
			if (ts.isClassLike(current)) {
				return this.boundary_owner(current);
			}
			current = current.parent;
		}
		return "";
	}
}
