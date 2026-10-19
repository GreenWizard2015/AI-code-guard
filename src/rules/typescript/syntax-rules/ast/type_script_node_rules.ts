import { DynamicRuntimeUsage } from "src/rules/typescript/syntax-rules/runtime/dynamic_runtime_usage";
import { TypeScriptTestNodeRules } from "src/rules/typescript/syntax-rules/runtime/type_script_test_node_rules";
import { TypeScriptClassNodeRules } from "src/rules/typescript/syntax-rules/ast/type_script_class_node_rules";
import { ProxyRules } from "src/rules/typescript/syntax-rules/callables/proxy_rules";
import { ProxyCall } from "src/rules/typescript/syntax-rules/callables/proxy_call";
import { TypeScriptAssignmentPredicates } from "src/parser/internals/type_script_assignment_predicates";
import { TypeScriptTypeRules } from "src/rules/typescript/syntax-rules/types/type_script_type_rules";
import { TypeScriptArrayStateRules } from "src/rules/typescript/syntax-rules/types/type_script_array_state_rules";
import type {
	TypeScriptArrayStateRulesContract,
	TypeScriptAssignmentPredicatesContract,
	ProxyRulesContract,
	ValueRulesContract,
	RestUnionContractRuleContract,
	TypeScriptClassNodeRulesContract,
	TypeScriptNodeTypeRulesContract,
} from "src/protocols";
import type { DynamicRuntimeUsageContract } from "src/protocols";
import { ValueRules } from "src/linting/value_rules";
import { RestUnionContractRule } from "src/rules/typescript/syntax-rules/types/rest_union_contract_rule";
import ts from "typescript";
import { RULE_IDS } from "src/constants";
import type { RuleContextData } from "src/types";
import type { TypeScriptNodeRulesContract } from "src/protocols";
import type { TypeScriptTestNodeRulesContract } from "src/protocols";
import { TypeScriptCallExpressionInspector } from "src/parser/analysis/type_script_call_expression_inspector";
import { TypeScriptArrayStateInspector } from "src/rules/typescript/syntax-rules/types/type_script_array_state_inspector";
import { TypeScriptCallAliases } from "src/rules/typescript/syntax-rules/callables/type_script_call_aliases";
import { TypeScriptBindingAliases } from "src/typescript-aliases/type_script_binding_aliases";
import { TypeScriptExpressionNames } from "src/typescript-aliases/type_script_expression_names";
import { TypeScriptVariableDeclarationIndex } from "src/linting/type_script_variable_declaration_index";

/** Responsibilities: _TypeScript node classification_, _syntax rule dispatch_. **/
export class TypeScriptNodeRules implements TypeScriptNodeRulesContract {
	private readonly class_rule_kinds = this.syntax_kind_flags([
		ts.SyntaxKind.InterfaceDeclaration,
		ts.SyntaxKind.MethodDeclaration,
		ts.SyntaxKind.GetAccessor,
		ts.SyntaxKind.SetAccessor,
		ts.SyntaxKind.PropertyDeclaration,
		ts.SyntaxKind.BinaryExpression,
		ts.SyntaxKind.CallExpression,
		ts.SyntaxKind.PropertyAccessExpression,
		ts.SyntaxKind.ElementAccessExpression,
		ts.SyntaxKind.Constructor,
		ts.SyntaxKind.PrefixUnaryExpression,
		ts.SyntaxKind.PostfixUnaryExpression,
	]);
	private readonly context_rule_kinds = this.syntax_kind_flags([
		ts.SyntaxKind.TupleType,
		ts.SyntaxKind.BinaryExpression,
		ts.SyntaxKind.FunctionDeclaration,
		ts.SyntaxKind.MethodDeclaration,
		ts.SyntaxKind.ArrowFunction,
		ts.SyntaxKind.FunctionExpression,
	]);
	private readonly value_rule_kinds = this.syntax_kind_flags([
		ts.SyntaxKind.Identifier,
		ts.SyntaxKind.CallExpression,
		ts.SyntaxKind.ObjectLiteralExpression,
		ts.SyntaxKind.ElementAccessExpression,
	]);
	private readonly dynamic_runtime_kinds = this.syntax_kind_flags([
		ts.SyntaxKind.ElementAccessExpression,
		ts.SyntaxKind.PropertyAccessExpression,
		ts.SyntaxKind.CallExpression,
		ts.SyntaxKind.NewExpression,
	]);
	private readonly runtime_rule_kinds = this.syntax_kind_flags([
		ts.SyntaxKind.Parameter,
		ts.SyntaxKind.ElementAccessExpression,
		ts.SyntaxKind.PropertyAccessExpression,
		ts.SyntaxKind.CallExpression,
		ts.SyntaxKind.NewExpression,
		ts.SyntaxKind.MethodSignature,
		ts.SyntaxKind.CallSignature,
		ts.SyntaxKind.JSDocSignature,
		ts.SyntaxKind.ConstructSignature,
		ts.SyntaxKind.IndexSignature,
		ts.SyntaxKind.FunctionType,
		ts.SyntaxKind.JSDocFunctionType,
		ts.SyntaxKind.ConstructorType,
		ts.SyntaxKind.FunctionDeclaration,
		ts.SyntaxKind.MethodDeclaration,
		ts.SyntaxKind.Constructor,
		ts.SyntaxKind.GetAccessor,
		ts.SyntaxKind.SetAccessor,
		ts.SyntaxKind.FunctionExpression,
		ts.SyntaxKind.ArrowFunction,
	]);
	private readonly call_rule_kinds = this.syntax_kind_flags([
		ts.SyntaxKind.CallExpression,
		ts.SyntaxKind.ElementAccessExpression,
		ts.SyntaxKind.IfStatement,
	]);
	private readonly guard_rule_kinds = this.syntax_kind_flags([
		ts.SyntaxKind.FunctionDeclaration,
		ts.SyntaxKind.MethodDeclaration,
		ts.SyntaxKind.GetAccessor,
		ts.SyntaxKind.SetAccessor,
		ts.SyntaxKind.MethodSignature,
		ts.SyntaxKind.CallSignature,
		ts.SyntaxKind.JSDocSignature,
		ts.SyntaxKind.ConstructSignature,
		ts.SyntaxKind.Constructor,
		ts.SyntaxKind.FunctionExpression,
		ts.SyntaxKind.ArrowFunction,
		ts.SyntaxKind.JSDocFunctionType,
		ts.SyntaxKind.ConstructorType,
	]);
	private readonly script_type_rules: TypeScriptNodeTypeRulesContract;
	private readonly dynamic_runtime_usage: DynamicRuntimeUsageContract;
	private readonly test_node_rules: TypeScriptTestNodeRulesContract;
	private readonly proxy_rules: ProxyRulesContract;
	private readonly value_rules: ValueRulesContract;
	private readonly script_assignment_predicates: TypeScriptAssignmentPredicatesContract;
	private readonly array_state_rules: TypeScriptArrayStateRulesContract;
	private readonly class_rules: TypeScriptClassNodeRulesContract;
	private readonly rest_union_contract: RestUnionContractRuleContract;
	private readonly call_expression_inspector: TypeScriptCallExpressionInspector;
	private readonly rule_ids = {
		proxy_callable: RULE_IDS.proxy_callable,
		type_guard: RULE_IDS.typescript_type_guard,
	};

	/** Responsibilities: _fixed syntax kind lookup_. **/
	private syntax_kind_flags(kinds: readonly ts.SyntaxKind[]): Uint8Array {
		const flags = new Uint8Array(ts.SyntaxKind.Count + 1);
		for (const kind of kinds) {
			flags[kind] = 1;
		}
		return flags;
	}

	/** Responsibilities: _TypeScript type guards identification_. **/
	private is_type_guard(node: ts.Node): boolean {
		if (!ts.isFunctionLike(node)) {
			return false;
		}
		if (node.type === undefined) {
			return false;
		}
		return ts.isTypePredicateNode(node.type);
	}

	/** Responsibilities: _proxy-callable rules addition_. **/
	private append_proxy_rule(node: ts.Node, context: RuleContextData): void {
		if (!context.test_file && this.proxy_rules.proxy_callable(node)) {
			context.append_rule(node, this.rule_ids.proxy_callable);
		}
	}

	/** Responsibilities: _proxy-lambda rules addition_. **/
	private append_proxy_lambda(node: ts.Node, context: RuleContextData): void {
		if (!context.test_file && this.proxy_rules.proxy_lambda(node)) {
			context.append_rule(node, RULE_IDS.proxy_lambda);
		}
	}

	/** Responsibilities: _type guard rule dispatch_. **/
	private append_guard(node: ts.Node, context: RuleContextData): void {
		if (this.guard_rule_kinds[node.kind] !== 1) {
			return;
		}
		if (this.is_type_guard(node)) {
			context.append_rule(node, this.rule_ids.type_guard);
		}
	}

	/** Responsibilities: _callable expression rules_. **/
	private append_call_rules(node: ts.Node, context: RuleContextData): void {
		const kind = node.kind;
		if (kind === ts.SyntaxKind.CallExpression) {
			if (this.call_expression_inspector.bind_call(node)) {
				context.append_rule(node, RULE_IDS.typescript_bind);
			}
		}
		if (kind === ts.SyntaxKind.ElementAccessExpression || kind === ts.SyntaxKind.CallExpression) {
			this.array_state_rules.append(node, context);
			return;
		}
		if (kind === ts.SyntaxKind.IfStatement) {
			this.array_state_rules.append(node, context);
		}
	}

	/** Responsibilities: _context-sensitive rules_. **/
	private context_rules(node: ts.Node, inside_constructor: boolean, context: RuleContextData): void {
		switch (node.kind) {
			case ts.SyntaxKind.TupleType:
				context.append_rule(node, RULE_IDS.tuple_type);
				break;
			case ts.SyntaxKind.BinaryExpression:
				this.append_mutable_rule(node, inside_constructor, context);
				break;
			case ts.SyntaxKind.FunctionDeclaration:
			case ts.SyntaxKind.MethodDeclaration:
				this.append_proxy_rule(node, context);
				break;
			case ts.SyntaxKind.ArrowFunction:
			case ts.SyntaxKind.FunctionExpression:
				this.append_proxy_lambda(node, context);
				break;
		}
	}

	/** Responsibilities: _node rules_. **/
	private node_rules(node: ts.Node, inside_constructor: boolean, context: RuleContextData): void {
		if (this.class_rule_kinds[node.kind] === 1) {
			this.class_rules.append(node, context);
		}
		if (node.kind === ts.SyntaxKind.CallExpression || node.kind === ts.SyntaxKind.BinaryExpression) {
			this.test_node_rules.append_rules(node, context);
		}
		if (this.context_rule_kinds[node.kind] === 1) {
			this.context_rules(node, inside_constructor, context);
		}
	}

	/** Responsibilities: _runtime kind rules_. **/
	private append_runtime_rules(node: ts.Node, context: RuleContextData): void {
		if (node.kind === ts.SyntaxKind.Parameter) {
			this.rest_union_contract.append_rule(node, context);
		}
		if (this.dynamic_runtime_kinds[node.kind] === 1) {
			this.dynamic_runtime_usage.append_candidate_rule(node, context);
		}
		this.append_guard(node, context);
	}

	/** Responsibilities: _TypeScript node rules initialization_. **/
	constructor() {
		const variable_declaration_index = new TypeScriptVariableDeclarationIndex();
		this.script_assignment_predicates = new TypeScriptAssignmentPredicates();
		this.rest_union_contract = new RestUnionContractRule();
		this.call_expression_inspector = new TypeScriptCallExpressionInspector();
		this.test_node_rules = new TypeScriptTestNodeRules();
		this.dynamic_runtime_usage = new DynamicRuntimeUsage();
		this.value_rules = new ValueRules(variable_declaration_index);
		this.class_rules = new TypeScriptClassNodeRules(this.value_rules);
		this.script_type_rules = new TypeScriptTypeRules(variable_declaration_index);
		const expression_names = new TypeScriptExpressionNames();
		const binding_aliases = new TypeScriptBindingAliases(expression_names);
		const call_aliases = new TypeScriptCallAliases(expression_names, binding_aliases);
		const inspector = new TypeScriptArrayStateInspector(expression_names, call_aliases);
		this.array_state_rules = new TypeScriptArrayStateRules(inspector);
		this.proxy_rules = new ProxyRules(new ProxyCall(expression_names));
	}

	/** Responsibilities: _node rule aggregation_. **/
	public append_node_rules(node: ts.Node, inside_constructor: boolean, context: RuleContextData): void {
		this.node_rules(node, inside_constructor, context);
		if (this.runtime_rule_kinds[node.kind] === 1) {
			this.append_runtime_rules(node, context);
		}
		if (this.call_rule_kinds[node.kind] === 1) {
			this.append_call_rules(node, context);
		}
		this.script_type_rules.append_type_rules(node, context);
		if (this.value_rule_kinds[node.kind] === 1) {
			this.value_rules.append_value_rules(node, context.test_file, context.append_rule);
		}
	}

	/** Responsibilities: _mutable-field rules addition_. **/
	public append_mutable_rule(node: ts.Node, inside_constructor: boolean, context: RuleContextData): void {
		if (
			this.script_assignment_predicates.field_assignment(node, {
				test_file: context.test_file,
				inside_constructor,
			})
		) {
			context.append_rule(node, RULE_IDS.mutable_field_assignment);
		}
	}
}
