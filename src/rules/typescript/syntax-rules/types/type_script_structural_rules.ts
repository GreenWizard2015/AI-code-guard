import { TypeScriptArithmeticPrecedence } from "src/rules/typescript/syntax-rules/expressions/type_script_arithmetic_precedence";
import { TypeScriptLogicalChain } from "src/rules/typescript/syntax-rules/expressions/type_script_logical_chain";
import { INDEX_SIGNATURE, INTERFACE_RULE_ID, UNBOUNDED_TYPE } from "src/parser/internals/constants";
import ts from "typescript";
import type { CallableShapeCounts, RuleAppender, RuleContextData } from "src/types";
import { TypeScriptTypeAliases } from "src/typescript-aliases/type_script_type_aliases";
import { TypeScriptCallableBody } from "src/typescript-aliases/callables/type_script_callable_body";
import type { TypeScriptOperatorPrecedenceContract, TypeScriptStructuralRulesContract } from "src/protocols";
import { RULE_IDS } from "src/constants";

/** Responsibilities: _type shapes_, _syntax rules_. **/
export class TypeScriptStructuralRules implements TypeScriptStructuralRulesContract {
	private readonly data_member_kinds: Set<ts.SyntaxKind>;
	private readonly logical_chain: TypeScriptLogicalChain;
	private readonly operator_precedence: TypeScriptOperatorPrecedenceContract;
	private readonly arithmetic_precedence: TypeScriptArithmeticPrecedence;
	private readonly type_aliases: TypeScriptTypeAliases;
	private readonly callable_body: TypeScriptCallableBody;
	private readonly unbounded_type_names: Set<string>;
	private readonly unbounded_type_kinds = this.syntax_kind_flags([
		ts.SyntaxKind.AnyKeyword,
		ts.SyntaxKind.UnknownKeyword,
		ts.SyntaxKind.ObjectKeyword,
		ts.SyntaxKind.TypeReference,
	]);
	private readonly callable_body_cache: WeakMap<ts.Node, boolean>;

	/** Responsibilities: _classification type member storage_. **/
	private is_data_member(member: ts.TypeElement): boolean {
		if (!this.data_member_kinds.has(member.kind)) {
			return false;
		}
		if (ts.isPropertySignature(member)) {
			return true;
		}
		return ts.isIndexSignatureDeclaration(member);
	}

	/** Responsibilities: _classification type member callable_. **/
	private is_callable_member(member: ts.TypeElement): boolean {
		if (ts.isCallSignatureDeclaration(member)) {
			return true;
		}
		if (ts.isMethodSignature(member)) {
			return true;
		}
		return this.callable_property(member);
	}

	/** Responsibilities: _callable data member count_. **/
	private callable_shape_counts(node: ts.TypeAliasDeclaration): CallableShapeCounts {
		const counts = { callables: 0, data: 0 };
		if (!ts.isTypeLiteralNode(node.type)) {
			return counts;
		}
		for (const member of node.type.members) {
			if (this.is_callable_member(member)) {
				counts.callables += 1;
			} else if (this.is_data_member(member)) {
				counts.data += 1;
			}
		}
		return counts;
	}

	/** Responsibilities: _classification property signature whose_. **/
	private callable_property(member: ts.TypeElement): boolean {
		if (!ts.isPropertySignature(member)) {
			return false;
		}
		if (member.type === undefined) {
			return false;
		}
		return ts.isFunctionTypeNode(member.type);
	}

	/** Responsibilities: _callable-body membership lookup_. **/
	private in_callable_body(node: ts.Node): boolean {
		const cached = this.callable_body_cache.get(node);
		if (cached !== undefined) {
			return cached;
		}
		let current: ts.Node | undefined = node;
		while (current !== undefined && current.parent !== undefined) {
			const parent: ts.Node = current.parent;
			const body = this.callable_body.resolve<ts.Node | undefined>(parent, undefined, (candidate) => candidate);
			if (body === current) {
				this.callable_body_cache.set(node, true);
				return true;
			}
			current = parent;
		}
		this.callable_body_cache.set(node, false);
		return false;
	}

	/** Responsibilities: _classification node usage unbounded_. **/
	private is_unbounded_type(node: ts.Node): boolean {
		if (node.kind === ts.SyntaxKind.AnyKeyword || node.kind === ts.SyntaxKind.UnknownKeyword) {
			return true;
		}
		if (node.kind === ts.SyntaxKind.ObjectKeyword) {
			return true;
		}
		if (!ts.isTypeReferenceNode(node)) {
			return false;
		}
		const type_name = node.typeName.getText();
		return this.unbounded_type_names.has(this.type_aliases.resolve(type_name));
	}

	/** Responsibilities: _SyntaxKind flag construction_. **/
	private syntax_kind_flags(kinds: readonly ts.SyntaxKind[]): Uint8Array {
		const flags = new Uint8Array(ts.SyntaxKind.Count + 1);
		for (const kind of kinds) {
			flags[kind] = 1;
		}
		return flags;
	}

	/** Responsibilities: _aggregation interface-shape rules type_. **/
	private append_interface_shape(node: ts.Node, test_file: boolean, append_rule: RuleAppender): void {
		if (test_file) {
			return;
		}
		if (!ts.isTypeAliasDeclaration(node)) {
			return;
		}
		if (!ts.isTypeLiteralNode(node.type)) {
			return;
		}
		const counts = this.callable_shape_counts(node);
		const callable_only = counts.callables > 3 && counts.data === 0;
		const empty_shape = counts.callables === 0 && counts.data === 0;
		if (callable_only || empty_shape) {
			append_rule(node, INTERFACE_RULE_ID);
		}
	}

	/** Responsibilities: _TypeScript structural rule initialization_. **/
	public constructor(operator_precedence: TypeScriptOperatorPrecedenceContract) {
		this.callable_body_cache = new WeakMap<ts.Node, boolean>();
		this.data_member_kinds = new Set([ts.SyntaxKind.PropertySignature, ts.SyntaxKind.IndexSignature]);
		this.logical_chain = new TypeScriptLogicalChain();
		this.arithmetic_precedence = new TypeScriptArithmeticPrecedence();
		this.type_aliases = new TypeScriptTypeAliases();
		this.callable_body = new TypeScriptCallableBody();
		this.unbounded_type_names = new Set(["any", "unknown", "object", "Object"]);
		this.operator_precedence = operator_precedence;
	}

	/** Responsibilities: _aggregation type-level structural rules_. **/
	public append_type_rules(node: ts.Node, context: RuleContextData): void {
		if (node === context.source_file) {
			this.type_aliases.collect(context.source_file);
		}
		if (this.unbounded_type_kinds[node.kind] === 1) {
			const is_unbounded = this.is_unbounded_type(node);
			const alias_type =
				node.parent !== undefined && ts.isTypeAliasDeclaration(node.parent) && node.parent.type === node;
			if (is_unbounded && (!this.in_callable_body(node) || alias_type)) {
				context.append_rule(node, UNBOUNDED_TYPE);
			}
		}
		if (ts.isIndexSignatureDeclaration(node)) {
			context.append_rule(node, INDEX_SIGNATURE);
		}
		if (ts.isTypeAliasDeclaration(node)) {
			this.append_interface_shape(node, context.test_file, context.append_rule);
		}
	}

	/** Responsibilities: _aggregation structural rules applicable_. **/
	public append(node: ts.Node, context: RuleContextData): void {
		if (ts.isBinaryExpression(node)) {
			if (this.logical_chain.long_chain(node)) {
				context.append_rule(node, RULE_IDS.logical_chain_size);
			}
			if (this.operator_precedence.mixed_boolean_operator(node)) {
				context.append_rule(node, RULE_IDS.mixed_boolean_precedence);
			}
			if (this.arithmetic_precedence.mixed_operator(node)) {
				context.append_rule(node, RULE_IDS.mixed_arithmetic_precedence);
			}
		}
		this.append_type_rules(node, context);
	}
}
