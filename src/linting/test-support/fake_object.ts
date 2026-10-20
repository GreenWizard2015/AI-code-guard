import ts from "typescript";
import { TypeScriptCallableAliases } from "src/linting/test-support/type_script_callable_aliases";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/type_script_expression_aliases";
import { TypeScriptObjectCallableAliases } from "src/linting/test-support/type_script_object_callable_aliases";
import type { FakeObjectContract } from "src/shared_services_protocols";
import type { TypeScriptObjectCallableAliasesContract } from "src/typescript_runtime_protocols";
import { ExternalContractTypes } from "src/linting/test-support/external_contract_types";

/** Responsibilities: _callable object properties identification_, _fake objects classification_. **/
export class FakeObject implements FakeObjectContract {
	private readonly callable_aliases: TypeScriptCallableAliases;
	private readonly expression_aliases: TypeScriptExpressionAliases;
	private readonly object_aliases: TypeScriptObjectCallableAliasesContract;
	private readonly callable_kinds: Set<ts.SyntaxKind>;
	private readonly external_contract_types: ExternalContractTypes;

	/** Responsibilities: _callable shorthand member classification_. **/
	private callable_shorthand(property: ts.ShorthandPropertyAssignment): boolean {
		if (this.callable_aliases.contains(property.name, property)) {
			return true;
		}
		return this.object_aliases.contains(property.name, property);
	}

	/** Responsibilities: _callable assigned member classification_. **/
	private callable_assignment(property: ts.PropertyAssignment): boolean {
		const initializer = this.expression_aliases.unwrapped(property.initializer);
		if (this.callable_kinds.has(initializer.kind)) {
			return true;
		}
		if (this.callable_aliases.contains(initializer, property)) {
			return true;
		}
		return this.object_aliases.contains(initializer, property);
	}

	/** Responsibilities: _external contract variable initializer_. **/
	private variable_contract_initializer(
		node: ts.ObjectLiteralExpression,
		declaration: ts.VariableDeclaration,
	): boolean {
		if (declaration.initializer !== node || declaration.type === undefined) {
			return false;
		}
		return this.external_contract_types.external_contract_type(node.getSourceFile(), declaration.type);
	}

	/** Responsibilities: _external contract property initializer_. **/
	private property_contract_initializer(node: ts.ObjectLiteralExpression, property: ts.PropertyDeclaration): boolean {
		if (property.initializer !== node || property.type === undefined) {
			return false;
		}
		return this.external_contract_types.external_contract_type(node.getSourceFile(), property.type);
	}

	/** Responsibilities: _this property assignment_. **/
	private this_property_assignment(parent: ts.BinaryExpression, node: ts.ObjectLiteralExpression): boolean {
		if (parent.right !== node || parent.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return false;
		}
		if (!ts.isPropertyAccessExpression(parent.left)) {
			return false;
		}
		return parent.left.expression.kind === ts.SyntaxKind.ThisKeyword;
	}

	/** Responsibilities: _typed assigned contract property_. **/
	private assigned_contract_property(node: ts.ObjectLiteralExpression, owner: ts.ClassLikeDeclaration): boolean {
		const assignment = node.parent;
		if (!ts.isBinaryExpression(assignment) || !ts.isPropertyAccessExpression(assignment.left)) {
			return false;
		}
		const assigned_name = assignment.left.name.text;
		for (const member of owner.members) {
			if (this.external_contract_property(node, member, assigned_name)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _typed contract property match_. **/
	private external_contract_property(
		node: ts.ObjectLiteralExpression,
		member: ts.ClassElement,
		assigned_name: string,
	): boolean {
		if (!ts.isPropertyDeclaration(member)) {
			return false;
		}
		if (!ts.isIdentifier(member.name) || member.name.text !== assigned_name) {
			return false;
		}
		if (member.type === undefined) {
			return false;
		}
		return this.external_contract_types.external_contract_type(node.getSourceFile(), member.type);
	}

	/** Responsibilities: _external contract assignment lookup_. **/
	private external_contract_assignment(node: ts.ObjectLiteralExpression): boolean {
		const parent = node.parent;
		if (!ts.isBinaryExpression(parent) || !this.this_property_assignment(parent, node)) {
			return false;
		}
		let owner: ts.Node | undefined = parent.parent;
		while (owner !== undefined && !ts.isClassLike(owner)) {
			owner = owner.parent;
		}
		return owner !== undefined && ts.isClassLike(owner) && this.assigned_contract_property(node, owner);
	}

	/** Responsibilities: _external contract object classification_. **/
	private external_contract_implementation(node: ts.ObjectLiteralExpression): boolean {
		const parent = node.parent;
		if (ts.isVariableDeclaration(parent)) {
			return this.variable_contract_initializer(node, parent);
		}
		if (ts.isPropertyDeclaration(parent)) {
			return this.property_contract_initializer(node, parent);
		}
		return this.external_contract_assignment(node);
	}

	/** Responsibilities: _fake object dependency initialization_. **/
	public constructor() {
		this.callable_aliases = new TypeScriptCallableAliases();
		this.expression_aliases = new TypeScriptExpressionAliases("");
		this.callable_kinds = new Set([
			ts.SyntaxKind.MethodDeclaration,
			ts.SyntaxKind.GetAccessor,
			ts.SyntaxKind.SetAccessor,
			ts.SyntaxKind.ArrowFunction,
			ts.SyntaxKind.FunctionExpression,
		]);
		this.object_aliases = new TypeScriptObjectCallableAliases();
		this.external_contract_types = new ExternalContractTypes();
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
		if (this.external_contract_implementation(node)) {
			return false;
		}
		return this.contains_callable_property(node);
	}
}
