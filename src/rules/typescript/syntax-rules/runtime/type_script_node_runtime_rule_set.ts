import type { ProxyRulesContract } from "src/analysis_protocols";
import type { ASTSourceRuleContract, ASTVerifierRegistrationContract } from "src/ast_verifier_protocols";
import { TypeScriptCallExpressionInspector } from "src/parser/analysis/type_script_call_expression_inspector";
import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import type { RuleContract } from "src/reporting_protocols";
import { TypeScriptContextNodeVerifier } from "src/rules/typescript/syntax-rules/ast/verifier/dispatch/type_script_context_node_verifier";
import { TypeScriptSyntaxNodeVerifier } from "src/rules/typescript/syntax-rules/ast/verifier/dispatch/type_script_syntax_node_verifier";
import { ModuleNamespaceImports } from "src/rules/typescript/syntax-rules/callables/module_namespace_imports";
import { PlatformApiDetector } from "src/rules/typescript/syntax-rules/callables/platform_api_detector";
import { ProxyCall } from "src/rules/typescript/syntax-rules/callables/proxy_call";
import { ProxyRules } from "src/rules/typescript/syntax-rules/callables/proxy_rules";
import { DynamicRuntimeUsage } from "src/rules/typescript/syntax-rules/runtime/dynamic_runtime_usage";
import { TypeScriptTestNodeRules } from "src/rules/typescript/syntax-rules/runtime/type_script_test_node_rules";
import type { DynamicRuntimeUsageContract } from "src/runtime_protocols";
import type { PlatformApiDetectionContract } from "src/typescript_analysis_protocols";
import type { TypeScriptCallExpressionInspectorContract } from "src/typescript_analysis_protocols";
import type { TypeScriptObjectAliasDeclarationIndexContract } from "src/typescript_runtime_protocols";
import type {
	TypeScriptExpressionAliasesContract,
	TypeScriptTestNodeRulesContract,
} from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _runtime AST rules_, _runtime verifier registration_. **/
export class TypeScriptNodeRuntimeRuleSet {
	public readonly _platform_api: PlatformApiDetectionContract;
	public readonly _this_aliases: TypeScriptExpressionAliasesContract;
	public readonly _call_expression_inspector: TypeScriptCallExpressionInspectorContract;
	public readonly _test_node_rules: TypeScriptTestNodeRulesContract;
	public readonly _dynamic_runtime_usage: DynamicRuntimeUsageContract;
	public readonly _proxy_rules: ProxyRulesContract;

	/** Responsibilities: _runtime node rule initialization_. **/
	public constructor(declaration_index: TypeScriptObjectAliasDeclarationIndexContract) {
		const expression_names = new TypeScriptExpressionNames();
		this._platform_api = new PlatformApiDetector({ module_namespace_imports: new ModuleNamespaceImports() });
		this._this_aliases = new TypeScriptExpressionAliases("this", declaration_index);
		this._call_expression_inspector = new TypeScriptCallExpressionInspector(declaration_index);
		this._test_node_rules = new TypeScriptTestNodeRules(declaration_index);
		this._dynamic_runtime_usage = new DynamicRuntimeUsage(declaration_index);
		this._proxy_rules = new ProxyRules(new ProxyCall(expression_names), declaration_index);
	}

	/** Responsibilities: _syntax node rule assembly_. **/
	public syntax_verifier(type_guard_rule: RuleContract, bind_rule: RuleContract): ASTSourceRuleContract {
		return new TypeScriptSyntaxNodeVerifier(
			{
				platform_api: this._platform_api,
				this_aliases: this._this_aliases,
				call_expression_inspector: this._call_expression_inspector,
				test_node_rules: this._test_node_rules,
				dynamic_runtime_usage: this._dynamic_runtime_usage,
				proxy_rules: this._proxy_rules,
			},
			type_guard_rule,
			bind_rule,
			this._call_expression_inspector,
		);
	}

	/** Responsibilities: _context rule registration_. **/
	public register_context_rules(registry: ASTVerifierRegistrationContract): void {
		registry.register(new TypeScriptContextNodeVerifier(this._proxy_rules), [
			ts.SyntaxKind.MethodDeclaration,
			ts.SyntaxKind.FunctionDeclaration,
			ts.SyntaxKind.ArrowFunction,
			ts.SyntaxKind.FunctionExpression,
			ts.SyntaxKind.TupleType,
		]);
	}

	/** Responsibilities: _runtime rule registration_. **/
	public register_runtime_rules(registry: ASTVerifierRegistrationContract): void {
		registry.register(this._dynamic_runtime_usage, [
			ts.SyntaxKind.CallExpression,
			ts.SyntaxKind.NewExpression,
			ts.SyntaxKind.PropertyAccessExpression,
			ts.SyntaxKind.ElementAccessExpression,
		]);
	}
}
