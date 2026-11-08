import { TypeScriptCallableAliases } from "src/linting/test-support/type_script_callable_aliases";
import { TypeScriptObjectCallableAliases } from "src/linting/test-support/type_script_object_callable_aliases";
import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import type { ExternalImportedTypesContract, FakeObjectContract } from "src/shared_services_protocols";
import type { TypeScriptObjectCallableAliasesContract } from "src/typescript_runtime_protocols";
import type {
	TypeScriptCallableAliasesContract,
	TypeScriptExpressionAliasesContract,
} from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _callable object properties identification_, _fake objects classification_. **/
export class FakeObject implements FakeObjectContract {
	private readonly _callable_aliases: TypeScriptCallableAliasesContract;
	private readonly _expression_aliases: TypeScriptExpressionAliasesContract;
	private readonly _object_aliases: TypeScriptObjectCallableAliasesContract;
	private readonly _callable_kinds: Set<ts.SyntaxKind>;
	private readonly _external_contract_types: ExternalImportedTypesContract;

	/** Responsibilities: _callable shorthand member classification_. **/
	private callable_shorthand(property: ts.ShorthandPropertyAssignment): boolean {
		if (this._callable_aliases.contains(property.name, property)) {
			return true;
		}
		return this._object_aliases.contains(property.name, property);
	}

	/** Responsibilities: _callable assigned member classification_. **/
	private callable_assignment(property: ts.PropertyAssignment): boolean {
		const initializer = this._expression_aliases.unwrapped(property.initializer);
		if (this._callable_kinds.has(initializer.kind)) {
			return true;
		}
		if (this._callable_aliases.contains(initializer, property)) {
			return true;
		}
		return this._object_aliases.contains(initializer, property);
	}

	/** Responsibilities: _external contract variable initializer_. **/
	private variable_contract_initializer(declaration: ts.VariableDeclaration): boolean {
		if (declaration.initializer === undefined || declaration.type === undefined) {
			return false;
		}
		return this._external_contract_types.external_contract_type(
			declaration.initializer.getSourceFile(),
			declaration.type,
		);
	}

	/** Responsibilities: _external contract property initializer_. **/
	private property_contract_initializer(property: ts.PropertyDeclaration): boolean {
		if (property.initializer === undefined || property.type === undefined) {
			return false;
		}
		return this._external_contract_types.external_contract_type(property.initializer.getSourceFile(), property.type);
	}

	/** Responsibilities: _typed assigned contract property_. **/
	private assigned_contract_property(owner: ts.ClassLikeDeclaration, assigned_name: string): boolean {
		for (const member of owner.members) {
			if (this.external_contract_property(member, assigned_name)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _typed contract property match_. **/
	private external_contract_property(member: ts.ClassElement, assigned_name: string): boolean {
		if (!ts.isPropertyDeclaration(member)) {
			return false;
		}
		if (!ts.isIdentifier(member.name) || member.name.text !== assigned_name) {
			return false;
		}
		if (member.type === undefined) {
			return false;
		}
		return this._external_contract_types.external_contract_type(member.getSourceFile(), member.type);
	}

	/** Responsibilities: _nearest class declaration lookup_. **/
	private class_owner(node: ts.Node): ts.Node {
		let owner = node;
		while (!ts.isClassLike(owner) && !ts.isSourceFile(owner)) {
			owner = owner.parent;
		}
		return owner;
	}

	/** Responsibilities: _external contract assignment lookup_. **/
	private external_contract_assignment(node: ts.ObjectLiteralExpression): boolean {
		const parent = node.parent;
		if (!ts.isBinaryExpression(parent) || parent.right !== node) {
			return false;
		}
		if (parent.operatorToken.kind !== ts.SyntaxKind.EqualsToken || !ts.isPropertyAccessExpression(parent.left)) {
			return false;
		}
		if (parent.left.expression.kind !== ts.SyntaxKind.ThisKeyword) {
			return false;
		}
		const owner = this.class_owner(parent.parent);
		if (!ts.isClassLike(owner)) {
			return false;
		}
		return this.assigned_contract_property(owner, parent.left.name.text);
	}

	/** Responsibilities: _constructor argument classification_. **/
	private constructor_argument(argument: ts.ObjectLiteralExpression, parent: ts.Node): boolean {
		if (!ts.isNewExpression(parent)) {
			return false;
		}
		const arguments_list = parent.arguments;
		if (arguments_list === undefined) {
			return false;
		}
		return arguments_list.includes(argument);
	}

	/** Responsibilities: _external contract initializer classification_. **/
	private external_contract_initializer(parent: ts.Node): boolean {
		if (ts.isVariableDeclaration(parent)) {
			return this.variable_contract_initializer(parent);
		}
		if (ts.isPropertyDeclaration(parent)) {
			return this.property_contract_initializer(parent);
		}
		return false;
	}

	/** Responsibilities: _fake object dependency initialization_. **/
	public constructor(external_contract_types: ExternalImportedTypesContract) {
		this._callable_aliases = new TypeScriptCallableAliases();
		this._expression_aliases = new TypeScriptExpressionAliases("", new TypeScriptObjectAliasDeclarationIndex());
		this._callable_kinds = new Set([
			ts.SyntaxKind.MethodDeclaration,
			ts.SyntaxKind.GetAccessor,
			ts.SyntaxKind.SetAccessor,
			ts.SyntaxKind.ArrowFunction,
			ts.SyntaxKind.FunctionExpression,
		]);
		this._object_aliases = new TypeScriptObjectCallableAliases();
		this._external_contract_types = external_contract_types;
	}

	/** Responsibilities: _identification callable object member_. **/
	public callable_member(property: ts.ObjectLiteralElementLike): boolean {
		if (ts.isMethodDeclaration(property) || ts.isGetAccessor(property) || ts.isSetAccessor(property)) {
			return true;
		}
		if (ts.isShorthandPropertyAssignment(property)) {
			return this.callable_shorthand(property);
		}
		if (ts.isPropertyAssignment(property)) {
			return this.callable_assignment(property);
		}
		return false;
	}

	/** Responsibilities: _identification callable properties object_. **/
	public contains_callable_property(node: ts.ObjectLiteralExpression): boolean {
		for (const property of node.properties) {
			if (this.callable_member(property)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _identification object literals containing_. **/
	public fake_object(node: ts.Node): boolean {
		if (!ts.isObjectLiteralExpression(node)) {
			return false;
		}
		const parent = node.parent;
		if (this.constructor_argument(node, parent) || this.external_contract_initializer(parent)) {
			return false;
		}
		if (this.external_contract_assignment(node)) {
			return false;
		}
		return this.contains_callable_property(node);
	}
}
