import { DynamicRuntimeUsage } from 'src/bridge/ts/parser-internals/dynamic-runtime-usage';
import { TypeScriptTestNodeRules } from 'src/bridge/ts/parser-internals/typescript-test-node-rules';
import { DeclarationPredicates } from 'src/bridge/ts/runner/declaration-predicates';
import { ProxyRules } from 'src/bridge/ts/runner/proxy-rules';
import { TypeScriptAssignmentPredicates } from 'src/bridge/ts/parser-internals/typescript-assignment-predicates';
import { TypeScriptTypeRules } from 'src/bridge/ts/parser-internals/typescript-type-rules';
import { TypeScriptArrayStateRules } from 'src/bridge/ts/parser-internals/typescript-array-state-rules';
import type { TypeScriptNodeTypeRules } from 'src/bridge/ts/parser-internals/protocols';
import { ValueRules } from 'src/bridge/ts/runner/value-rules';
import { RestUnionContractRule } from 'src/bridge/ts/parser-internals/type-union-rules/rest-union-contract';
import ts from 'typescript';
import type { RuleContextData } from 'src/types';








/** Responsibilities: _inspection TypeScript nodes classification_. **/
export class TypeScriptNodeRules {
	private readonly declaration_predicates = new DeclarationPredicates();
	private readonly dynamic_runtime_usage = new DynamicRuntimeUsage();
	private readonly test_node_rules = new TypeScriptTestNodeRules();
	private readonly proxy_rules = new ProxyRules();
	private readonly value_rules = new ValueRules();
	private readonly script_assignment_predicates = new TypeScriptAssignmentPredicates();
	private readonly script_type_rules: TypeScriptNodeTypeRules;
	private readonly array_state_rules = new TypeScriptArrayStateRules();
	private readonly rest_union_contract = new RestUnionContractRule();
	private readonly class_rule_kinds = new Set([
		ts.SyntaxKind.InterfaceDeclaration,
		ts.SyntaxKind.MethodDeclaration,
		ts.SyntaxKind.PropertyDeclaration,
		ts.SyntaxKind.BinaryExpression,
		ts.SyntaxKind.CallExpression,
		ts.SyntaxKind.Constructor,
	]);
	private readonly value_rule_kinds = new Set([
		ts.SyntaxKind.Identifier,
		ts.SyntaxKind.CallExpression,
		ts.SyntaxKind.ObjectLiteralExpression,
	]);
	private readonly rule_ids = {
		static_method: 'typescript-static-method',
		static_field: 'typescript-static-field',
		prototype_assignment: 'typescript-prototype-assignment',
		dynamic_type: 'dynamic-type',
		temporary_instance_method: 'temporary-instance-method-call',
		complex_constructor: 'complex-constructor',
		empty_contract: 'empty-contract',
		explicit_visibility: 'typescript-explicit-visibility',
		mutable_field: 'typescript-mutable-field',
		proxy_callable: 'proxy-callable',
		type_guard: 'typescript-type-guard',
	};

	/** Responsibilities: _declaration rule identifiers collection_. **/
	private declaration_rule_ids(node: ts.Node): string[] {
		const rule_ids: string[] = [];
if (ts.isInterfaceDeclaration(node) && node.members.length === 0) {
			rule_ids.push(this.rule_ids.empty_contract);
		}
		rule_ids.push(...this.static_rule_ids(node));
		if (this.declaration_predicates.prototype_assignment(node)) {
			rule_ids.push(this.rule_ids.prototype_assignment);
		}
		if (this.declaration_predicates.temp_method(node)) {
			rule_ids.push(this.rule_ids.temporary_instance_method);
		}
		if (this.declaration_predicates.complex_constructor(node)) {
			rule_ids.push(this.rule_ids.complex_constructor);
		}
		return rule_ids;
	}

	/** Responsibilities: _collection static declaration rule_. **/
	private static_rule_ids(node: ts.Node): string[] {
		const rule_ids: string[] = [];
		if (!this.declaration_predicates.static_declaration(node)) {
			return rule_ids;
		}
		if (ts.isMethodDeclaration(node)) {
			rule_ids.push(this.rule_ids.static_method);
		}
		if (ts.isPropertyDeclaration(node)) {
			rule_ids.push(this.rule_ids.static_field);
		}
		return rule_ids;
	}

	/** Responsibilities: _class-field rule identifiers collection_. **/
	private field_rule_ids(node: ts.Node, context: RuleContextData): string[] {
		const rule_ids: string[] = [];
		if (context.class_fields.missing_visibility(node, context.file)) {
			rule_ids.push(this.rule_ids.explicit_visibility);
		}
		if (context.class_fields.mutable_field(node, context.file)) {
			rule_ids.push(this.rule_ids.mutable_field);
		}
		return rule_ids;
	}

	/** Responsibilities: _TypeScript type guards identification_. **/
	private is_type_guard(node: ts.Node): boolean {
		if (!ts.isFunctionLike(node) || node.type === undefined) {
			return false;
		}
		return ts.isTypePredicateNode(node.type);
	}

	/** Responsibilities: _identification bind invocation_. **/
	private is_bind_call(node: ts.Node): boolean {
if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) {
			return false;
		}
		return node.expression.name.text === 'bind';
	}

	/** Responsibilities: _tuple-type rules addition_. **/
	private append_tuple_rule(node: ts.Node, context: RuleContextData): void {
		if (ts.isTupleTypeNode(node)) {
			context.append_rule(node, 'tuple-type');
		}
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
			context.append_rule(node, 'proxy-lambda');
		}
	}

	/** Responsibilities: _context-sensitive rules addition_. **/
	private append_context_rules(
		node: ts.Node,
		inside_constructor: boolean,
		context: RuleContextData
	): void {
		if (ts.isTupleTypeNode(node)) {
			this.append_tuple_rule(node, context);
		}
		if (ts.isBinaryExpression(node)) {
			this.append_mutable_rule(node, inside_constructor, context);
		}
if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
			this.append_proxy_rule(node, context);
		}
		if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
			this.append_proxy_lambda(node, context);
		}
	}

	/** Responsibilities: _node type rules addition_. **/
	private append_node_types(node: ts.Node, context: RuleContextData): void {
		this.rest_union_contract.append_rule(node, context);
		this.dynamic_runtime_usage.append_rule(node, context);
		if (ts.isFunctionLike(node) && this.is_type_guard(node)) {
			context.append_rule(node, this.rule_ids.type_guard);
		}
		if (ts.isCallExpression(node) && this.is_bind_call(node)) {
			context.append_rule(node, 'typescript-bind');
		}
if (ts.isElementAccessExpression(node) || ts.isIfStatement(node)) {
			this.array_state_rules.append(node, context);
		}
		this.script_type_rules.append_type_rules(node, context);
	}

	/** Responsibilities: _TypeScript node rules initialization_. **/
	constructor() {
		this.script_type_rules = new TypeScriptTypeRules();
	}

	/** Responsibilities: _aggregation rules TypeScript node_. **/
	public append_node_rules(
		node: ts.Node,
		inside_constructor: boolean,
		context: RuleContextData
	): void {
		if (this.class_rule_kinds.has(node.kind)) {
			this.append_class_rules(node, context);
		}
		if (this.test_node_rules.test_node(node)) {
			this.test_node_rules.append_rules(node, context);
		}
		this.append_context_rules(node, inside_constructor, context);
		this.append_node_types(node, context);
		if (this.value_rule_kinds.has(node.kind)) {
			this.value_rules.append_value_rules(node, context.test_file, context.append_rule);
		}
	}

	/** Responsibilities: _aggregation class rules TypeScript_. **/
	public append_class_rules(node: ts.Node, context: RuleContextData): void {
		const rule_ids = this.declaration_rule_ids(node);
		rule_ids.push(...this.field_rule_ids(node, context));
		if (this.value_rules.dynamic_class(node)) {
			rule_ids.push(this.rule_ids.dynamic_type);
		}
		for (const rule_id of rule_ids) {
			context.append_rule(node, rule_id);
		}
	}

	/** Responsibilities: _mutable-field rules addition_. **/
	public append_mutable_rule(
		node: ts.Node,
		inside_constructor: boolean,
		context: RuleContextData
	): void {
		if (this.script_assignment_predicates.field_assignment(node, context.test_file, inside_constructor)) {
			context.append_rule(node, 'mutable-field-assignment');
		}
	}
}
