import type { ProxyRulesContract } from "src/analysis_protocols";
import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import { TypeScriptMemberAliases } from "src/parser/typescript-aliases/type_script_member_aliases";
import { ModuleNamespaceImports } from "src/rules/typescript/syntax-rules/callables/module_namespace_imports";
import { PlatformApiDetector } from "src/rules/typescript/syntax-rules/callables/platform_api_detector";
import { ProxyArgumentMapper } from "src/rules/typescript/syntax-rules/callables/proxy_argument_mapper";
import { ProxyFieldAccessorCandidate } from "src/rules/typescript/syntax-rules/callables/proxy_field_accessor_candidate";
import type { ProxyCallContract } from "src/runtime_protocols";
import type { PlatformApiDetectionContract } from "src/typescript_analysis_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import type { TypeScriptObjectAliasDeclarationIndexContract } from "src/typescript_runtime_protocols";
import type { TypeScriptMemberAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _proxy callable classification_, _proxy lambda detection_. **/
export class ProxyRules implements ProxyRulesContract {
	private readonly _proxy_call: ProxyCallContract;
	private readonly _expression_aliases: TypeScriptExpressionAliasesContract;
	private readonly _this_aliases: TypeScriptMemberAliasesContract;
	private readonly _platform_api: PlatformApiDetectionContract;

	/** Responsibilities: _callable target expression_. **/
	private target_expression(proxy_target: ts.Node): ts.Expression {
		if (ts.isCallExpression(proxy_target)) {
			return proxy_target.expression;
		}
		if (ts.isNewExpression(proxy_target)) {
			return proxy_target.expression;
		}
		if (ts.isPropertyAccessExpression(proxy_target)) {
			return proxy_target;
		}
		throw new Error("Unsupported proxy call expression.");
	}

	/** Responsibilities: _this-target classification_. **/
	private this_call(this_invocation: ts.Node): boolean {
		if (!ts.isCallExpression(this_invocation)) {
			return false;
		}
		const expression = this._expression_aliases.unwrapped(this_invocation.expression);
		if (ts.isPropertyAccessExpression(expression)) {
			return expression.expression.kind === ts.SyntaxKind.ThisKeyword;
		}
		if (!ts.isIdentifier(expression)) {
			return false;
		}
		return this._this_aliases.member({ expression, node: this_invocation });
	}

	/** Responsibilities: _proxy lambda target_. **/
	private proxy_lambda_target(lambda_expression: ts.Node): boolean {
		const parent = lambda_expression.parent;
		if (!ts.isPropertyAssignment(parent)) {
			return false;
		}
		if (parent.initializer !== lambda_expression) {
			return false;
		}
		const calls = this._proxy_call.proxy_call(lambda_expression);
		for (const call of calls) {
			if (this.this_call(call)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _proxy target eligibility_. **/
	private supported_proxy_target(proxy_target: ts.Node): boolean {
		if (this._platform_api.platform_call(proxy_target)) {
			return false;
		}
		if (this._platform_api.platform_adapter_call(proxy_target)) {
			return false;
		}
		return this._proxy_call.supports_target_expression(this.target_expression(proxy_target));
	}

	/** Responsibilities: _owned collection mutation classification_. **/
	private owned_collection_mutation(collection_call: ts.Node): boolean {
		if (!ts.isCallExpression(collection_call) || !ts.isPropertyAccessExpression(collection_call.expression)) {
			return false;
		}
		const collection = collection_call.expression.expression;
		if (!ts.isPropertyAccessExpression(collection) || collection.expression.kind !== ts.SyntaxKind.ThisKeyword) {
			return false;
		}
		return [
			"add",
			"clear",
			"delete",
			"fill",
			"pop",
			"push",
			"reverse",
			"set",
			"shift",
			"sort",
			"splice",
			"unshift",
		].includes(collection_call.expression.name.text);
	}

	/** Responsibilities: _proxy call classification_. **/
	private proxy_call_candidate(callable_declaration: ts.Node, call: ts.Node): boolean {
		const accessor = new ProxyFieldAccessorCandidate(callable_declaration, call);
		if (accessor.implements_contract()) {
			if (accessor.returns_this_property()) {
				return true;
			}
		}
		if (this.owned_collection_mutation(call)) {
			return false;
		}
		if (!this.supported_proxy_target(call)) {
			return false;
		}
		const argument_mapping = new ProxyArgumentMapper(callable_declaration, call);
		const parameters = argument_mapping.parameter_names();
		return argument_mapping.matching_arguments(parameters);
	}

	/** Responsibilities: _proxy rule dependency initialization_. **/
	public constructor(proxy_call: ProxyCallContract, declaration_index: TypeScriptObjectAliasDeclarationIndexContract) {
		this._expression_aliases = new TypeScriptExpressionAliases("", declaration_index);
		this._this_aliases = new TypeScriptMemberAliases("this", () => "", declaration_index);
		this._platform_api = new PlatformApiDetector({
			module_namespace_imports: new ModuleNamespaceImports(),
		});
		this._proxy_call = proxy_call;
	}

	/** Responsibilities: _callable declaration forwarding_. **/
	public proxy_callable(callable_declaration: ts.Node): boolean {
		const calls = this._proxy_call.proxy_call(callable_declaration);
		for (const call of calls) {
			return this.proxy_call_candidate(callable_declaration, call);
		}
		return false;
	}

	/** Responsibilities: _proxy lambda forwarding_. **/
	public proxy_lambda(lambda_declaration: ts.Node): boolean {
		if (!ts.isArrowFunction(lambda_declaration) && !ts.isFunctionExpression(lambda_declaration)) {
			return false;
		}
		if (!this.proxy_lambda_target(lambda_declaration)) {
			return false;
		}
		return this.proxy_callable(lambda_declaration);
	}
}
