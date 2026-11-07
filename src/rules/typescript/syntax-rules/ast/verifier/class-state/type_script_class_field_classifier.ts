import { COLLECTION_TYPE_NAMES } from "src/constants";
import { READONLY_BUILTIN_TYPES, TYPESCRIPT_ARRAY_TYPE_NAME } from "src/metrics/constants";
import { TypeScriptAstTypeShape } from "src/rules/typescript/syntax-rules/ast/verifier/class-state/type_script_ast_type_shape";
import type {
	TypeScriptClassFieldClassification,
	TypeScriptClassFieldClassifierContract,
} from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _class field classification_, _collection ownership_. **/
export class TypeScriptClassFieldClassifier implements TypeScriptClassFieldClassifierContract {
	private readonly _declaration: ts.ClassLikeDeclaration;

	/** Responsibilities: _collection initializer recognition_. **/
	private collection_initializer(initializer: ts.Expression): boolean {
		if (!ts.isNewExpression(initializer)) {
			return false;
		}
		if (!ts.isIdentifier(initializer.expression)) {
			return false;
		}
		const name = initializer.expression.text;
		return this.collection_name(name);
	}

	/** Responsibilities: _collection type recognition_. **/
	private collection_name(name: string): boolean {
		if (name === TYPESCRIPT_ARRAY_TYPE_NAME) {
			return true;
		}
		if (COLLECTION_TYPE_NAMES.has(name)) {
			return true;
		}
		return READONLY_BUILTIN_TYPES.has(name);
	}

	/** Responsibilities: _field visibility classification_. **/
	private is_public(member: ts.PropertyDeclaration): boolean {
		if (!ts.canHaveModifiers(member)) {
			return true;
		}
		const modifiers = ts.getModifiers(member);
		if (modifiers === undefined) {
			return true;
		}
		for (const modifier of modifiers) {
			if (modifier.kind === ts.SyntaxKind.PrivateKeyword) {
				return false;
			}
			if (modifier.kind === ts.SyntaxKind.ProtectedKeyword) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _field type classification_. **/
	private field_shape(member: ts.PropertyDeclaration): TypeScriptClassFieldClassification {
		let data = false;
		let scalar = false;
		let collection = false;
		if (member.type === undefined && member.initializer !== undefined) {
			data = this.collection_initializer(member.initializer);
			collection = data;
		} else if (member.type !== undefined) {
			const shape = new TypeScriptAstTypeShape(member.type);
			data = shape.data_type();
			scalar = shape.scalar_type();
			collection = shape.collection_type();
		}
		return { data, scalar, collection, is_public: this.is_public(member) };
	}

	/** Responsibilities: _collection constructor argument recognition_. **/
	private is_collection_argument(argument: ts.Expression): boolean {
		if (!ts.isPropertyAccessExpression(argument)) {
			return false;
		}
		if (argument.expression.kind !== ts.SyntaxKind.ThisKeyword) {
			return false;
		}
		return this.field(argument.name.text).collection;
	}

	/** Responsibilities: _collection argument inspection_. **/
	private has_collection_argument(node: ts.NewExpression): boolean {
		for (const argument of node.arguments ?? []) {
			if (this.is_collection_argument(argument)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _class field classifier initialization_. **/
	public constructor(declaration: ts.ClassLikeDeclaration) {
		this._declaration = declaration;
	}

	/** Responsibilities: _field classification lookup_. **/
	public field(name: string): TypeScriptClassFieldClassification {
		for (const member of this._declaration.members) {
			if (!ts.isPropertyDeclaration(member)) {
				continue;
			}
			if (!ts.isIdentifier(member.name)) {
				continue;
			}
			if (member.name.text === name) {
				return this.field_shape(member);
			}
		}
		return { data: false, scalar: false, collection: false, is_public: false };
	}

	/** Responsibilities: _collection delegation detection_. **/
	public delegates_collection(): boolean {
		const pending: ts.Node[] = [this._declaration];
		while (pending.length > 0) {
			const node = pending.pop();
			if (node === undefined) {
				continue;
			}
			if (ts.isNewExpression(node) && this.has_collection_argument(node)) {
				return true;
			}
			ts.forEachChild(node, (child) => {
				pending.push(child);
			});
		}
		return false;
	}
}
