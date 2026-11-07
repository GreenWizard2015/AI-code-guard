import { TypeScriptMemberAliases } from "src/parser/typescript-aliases/type_script_member_aliases";
import type {
	TypeScriptConsoleAliasResolverContract,
	TypeScriptMemberAliasesContract,
	TypeScriptObjectAliasDeclarationIndexContract,
} from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _console mock identification_, _mock alias scope tracking_. **/
export class ConsoleMock {
	private readonly _mock_methods: Set<string>;
	private readonly _assignment_methods: Set<string>;
	private readonly _console_aliases: TypeScriptMemberAliasesContract;
	private readonly _jest_aliases: TypeScriptMemberAliasesContract;
	private readonly _console_alias_resolver: TypeScriptConsoleAliasResolverContract;

	/** Responsibilities: _mock method resolution_. **/
	private mock_method(mock_invocation: ts.CallExpression): string {
		const method = this._console_alias_resolver.member_name(mock_invocation.expression, mock_invocation);
		if (method !== "") {
			return method;
		}
		if (!ts.isIdentifier(mock_invocation.expression)) {
			return "";
		}
		if (
			!this._jest_aliases.property({
				expression: mock_invocation.expression,
				node: mock_invocation,
				name: "spyOn",
			})
		) {
			return "";
		}
		return "spyOn";
	}

	/** Responsibilities: _console mock call classification_. **/
	private is_mock_call(mock_invocation: ts.CallExpression): boolean {
		const method = this.mock_method(mock_invocation);
		if (!this._mock_methods.has(method)) {
			return false;
		}
		if (mock_invocation.arguments.length === 0) {
			return false;
		}
		const argument = mock_invocation.arguments.at(0);
		if (argument === undefined) {
			return false;
		}
		return this._console_alias_resolver.console_expression(argument, mock_invocation);
	}

	/** Responsibilities: _classification assignment targets console_. **/
	private console_assignment(assignment: ts.BinaryExpression): boolean {
		if (assignment.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return false;
		}
		if (!this.console_assignment_target(assignment.left, assignment)) {
			return false;
		}
		return this.assignment_value_allowed(assignment.right, assignment);
	}

	/** Responsibilities: _classification left-hand side console_. **/
	private console_assignment_target(target_expression: ts.Expression, access_source: ts.Node): boolean {
		if (!ts.isPropertyAccessExpression(target_expression)) {
			return false;
		}
		return this._console_alias_resolver.console_expression(target_expression.expression, access_source);
	}

	/** Responsibilities: _classification console assignment value_. **/
	private assignment_value_allowed(assignment_value: ts.Expression, value_source: ts.Node): boolean {
		if (!ts.isCallExpression(assignment_value)) {
			return false;
		}
		const method = this._console_alias_resolver.member_name(assignment_value.expression, value_source);
		if (method === "") {
			return false;
		}
		return this._assignment_methods.has(method);
	}

	/** Responsibilities: _classification node accesses console_. **/
	private is_console_property(property_access: ts.Node): boolean {
		if (!ts.isPropertyAccessExpression(property_access) && !ts.isElementAccessExpression(property_access)) {
			return false;
		}
		return this._console_alias_resolver.console_expression(property_access.expression, property_access);
	}

	/** Responsibilities: _classification console member alias_. **/
	private is_console_alias(console_invocation: ts.CallExpression): boolean {
		if (!ts.isIdentifier(console_invocation.expression)) {
			return false;
		}
		return this._console_aliases.member({ expression: console_invocation.expression, node: console_invocation });
	}

	/** Responsibilities: _reporting expression valid console_. **/
	/** Responsibilities: _field initialization_. **/
	public constructor(
		console_alias_resolver: TypeScriptConsoleAliasResolverContract,
		declaration_index: TypeScriptObjectAliasDeclarationIndexContract,
	) {
		this._mock_methods = new Set(["spyOn", "stub"]);
		this._assignment_methods = new Set(["fn", "mock"]);
		this._console_aliases = new TypeScriptMemberAliases("console", () => "", declaration_index);
		this._jest_aliases = new TypeScriptMemberAliases("jest", () => "", declaration_index);
		this._console_alias_resolver = console_alias_resolver;
	}

	/** Responsibilities: _reporting node defines console_. **/
	public console_mock(mock_candidate: ts.Node): boolean {
		if (ts.isCallExpression(mock_candidate)) {
			return this.is_mock_call(mock_candidate);
		}
		if (!ts.isBinaryExpression(mock_candidate)) {
			return false;
		}
		return this.console_assignment(mock_candidate);
	}

	/** Responsibilities: _reporting node performs disallowed_. **/
	public console_usage(usage_candidate: ts.Node): boolean {
		if (ts.isCallExpression(usage_candidate)) {
			if (this.is_console_property(usage_candidate.expression)) {
				return true;
			}
			return this.is_console_alias(usage_candidate);
		}
		if (!ts.isBinaryExpression(usage_candidate)) {
			return false;
		}
		if (!ts.isPropertyAccessExpression(usage_candidate.left)) {
			if (!ts.isElementAccessExpression(usage_candidate.left)) {
				return false;
			}
		}
		return this._console_alias_resolver.console_expression(usage_candidate.left.expression, usage_candidate);
	}
}
