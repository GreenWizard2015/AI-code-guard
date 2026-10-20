import ts from "typescript";
import { TypeScriptMemberAliases } from "src/typescript-aliases/type_script_member_aliases";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/type_script_expression_aliases";
import { TypeScriptObjectAliases } from "src/typescript-aliases/type_script_object_aliases";
import { TypeScriptObjectAliasDeclarationIndex } from "src/typescript-aliases/type_script_object_alias_declaration_index";
import { TypeScriptStaticExpressionValues } from "src/typescript-aliases/callables/type_script_static_expression_values";
import { TypeScriptStaticExpressionOperations } from "src/typescript-aliases/callables/type_script_static_expression_operations";
import type { TypeScriptMemberAliasesContract, TypeScriptObjectAliasesContract } from "src/typescript_runtime_protocols";

/** Responsibilities: _console mock identification_, _mock alias scope tracking_. **/
export class ConsoleMock {
	private readonly mock_methods: Set<string>;
	private readonly assignment_methods: Set<string>;
	private readonly console_aliases: TypeScriptMemberAliasesContract;
	private readonly jest_aliases: TypeScriptMemberAliasesContract;
	private readonly expression_aliases: TypeScriptExpressionAliases;
	private readonly static_expression_values: TypeScriptStaticExpressionValues;
	private readonly aliases_by_scope: Map<ts.Node, TypeScriptObjectAliasesContract>;
	private readonly declaration_index: TypeScriptObjectAliasDeclarationIndex;

	/** Responsibilities: _source object aliases_. **/
	private scope_key(node: ts.Node): ts.Node {
		let current = node;
		while (!ts.isSourceFile(current)) {
			if (ts.isFunctionLike(current)) {
				return current;
			}
			current = current.parent;
		}
		return current;
	}

	/** Responsibilities: _enclosing scope collection_. **/
	private scope_nodes(node: ts.Node): ts.Node[] {
		const scopes: ts.Node[] = [];
		let current = node;
		while (!ts.isSourceFile(current)) {
			if (ts.isFunctionLike(current)) {
				scopes.push(current);
			}
			current = current.parent;
		}
		scopes.push(current);
		return scopes.reverse();
	}

	/** Responsibilities: _source object aliases_. **/
	private object_aliases(source: ts.Node): TypeScriptObjectAliasesContract {
		const key = this.scope_key(source);
		const cached = this.aliases_by_scope.get(key);
		if (cached !== undefined) {
			return cached;
		}
		const aliases = new TypeScriptObjectAliases(this.declaration_index);
		for (const scope of this.scope_nodes(source)) {
			aliases.collect(scope);
		}
		this.aliases_by_scope.set(key, aliases);
		return aliases;
	}

	/** Responsibilities: _static console member name_. **/
	private member_name(expression: ts.Expression, source: ts.Node): string {
		if (ts.isPropertyAccessExpression(expression)) {
			return expression.name.text;
		}
		if (!ts.isElementAccessExpression(expression)) {
			return "";
		}
		if (expression.argumentExpression === undefined) {
			return "";
		}
		const key = this.expression_aliases.unwrapped(expression.argumentExpression);
		if (ts.isStringLiteral(key) || ts.isNoSubstitutionTemplateLiteral(key)) {
			return key.text;
		}
		return this.static_expression_values.value(expression.argumentExpression, source);
	}

	/** Responsibilities: _classification invocation invokes configuration_. **/
	private is_mock_call(node: ts.CallExpression): boolean {
		let method = this.member_name(node.expression, node);
		if (method === "") {
			if (!ts.isIdentifier(node.expression)) {
				return false;
			}
			if (!this.jest_aliases.property(node.expression, node, "spyOn")) {
				return false;
			}
			method = "spyOn";
		}
		if (!this.mock_methods.has(method)) {
			return false;
		}
		if (node.arguments.length === 0) {
			return false;
		}
		return this.console_expression(node.arguments[0], node);
	}

	/** Responsibilities: _classification assignment targets console_. **/
	private console_assignment(node: ts.BinaryExpression): boolean {
		if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return false;
		}
		if (!this.console_assignment_target(node.left, node)) {
			return false;
		}
		return this.assignment_value_allowed(node.right, node);
	}

	/** Responsibilities: _classification left-hand side console_. **/
	private console_assignment_target(node: ts.Expression, source: ts.Node): boolean {
		if (!ts.isPropertyAccessExpression(node)) {
			return false;
		}
		return this.console_expression(node.expression, source);
	}

	/** Responsibilities: _classification console assignment value_. **/
	private assignment_value_allowed(node: ts.Expression, source: ts.Node): boolean {
		if (!ts.isCallExpression(node)) {
			return false;
		}
		const method = this.member_name(node.expression, source);
		if (method === "") {
			return false;
		}
		return this.assignment_methods.has(method);
	}

	/** Responsibilities: _classification node accesses console_. **/
	private is_console_property(node: ts.Node): boolean {
		if (!ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)) {
			return false;
		}
		return this.console_expression(node.expression, node);
	}

	/** Responsibilities: _classification console property assignment_. **/
	private console_usage_assignment(node: ts.Node): boolean {
		if (!ts.isBinaryExpression(node)) {
			return false;
		}
		if (!ts.isPropertyAccessExpression(node.left) && !ts.isElementAccessExpression(node.left)) {
			return false;
		}
		return this.console_expression(node.left.expression, node);
	}

	/** Responsibilities: _classification console member alias_. **/
	private is_console_alias(node: ts.CallExpression): boolean {
		if (!ts.isIdentifier(node.expression)) {
			return false;
		}
		return this.console_aliases.member(node.expression, node);
	}

	/** Responsibilities: _reporting expression valid console_. **/
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.mock_methods = new Set(["spyOn", "stub"]);
		this.assignment_methods = new Set(["fn", "mock"]);
		this.console_aliases = new TypeScriptMemberAliases("console", () => "");
		this.jest_aliases = new TypeScriptMemberAliases("jest", () => "");
		this.expression_aliases = new TypeScriptExpressionAliases("");
		this.static_expression_values = new TypeScriptStaticExpressionValues(new TypeScriptStaticExpressionOperations());
		this.aliases_by_scope = new Map<ts.Node, TypeScriptObjectAliasesContract>();
		this.declaration_index = new TypeScriptObjectAliasDeclarationIndex();
	}
	/** Responsibilities: _public operation_. **/
	public console_expression(node: ts.Expression, source: ts.Node): boolean {
		if (ts.isIdentifier(node)) {
			return node.text === "console";
		}
		if (ts.isPropertyAccessExpression(node)) {
			const values = this.object_aliases(source).property_values(node.expression, node.name.text);
			return values.some((value) => this.console_expression(value, source));
		}
		if (!ts.isElementAccessExpression(node)) {
			return false;
		}
		if (node.argumentExpression === undefined) {
			return false;
		}
		const property_name = this.static_expression_values.value(node.argumentExpression, source);
		const values = this.object_aliases(source).property_values(node.expression, property_name);
		return values.some((value) => this.console_expression(value, source));
	}

	/** Responsibilities: _reporting node defines console_. **/
	public console_mock(node: ts.Node): boolean {
		if (ts.isCallExpression(node)) {
			return this.is_mock_call(node);
		}
		if (!ts.isBinaryExpression(node)) {
			return false;
		}
		return this.console_assignment(node);
	}

	/** Responsibilities: _reporting node performs disallowed_. **/
	public console_usage(node: ts.Node): boolean {
		if (ts.isCallExpression(node)) {
			if (this.is_console_property(node.expression)) {
				return true;
			}
			return this.is_console_alias(node);
		}
		return this.console_usage_assignment(node);
	}
}
