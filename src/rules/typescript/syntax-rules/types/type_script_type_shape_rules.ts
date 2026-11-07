import { TYPE_SCRIPT_CALLABLE_BODY_KINDS } from "src/constants";
import { INDEX_SIGNATURE, INTERFACE_RULE_ID, UNBOUNDED_TYPE } from "src/parser/internals/constants";
import { TypeScriptCallableBody } from "src/parser/typescript-aliases/callables/type_script_callable_body";
import { TypeScriptTypeAliases } from "src/parser/typescript-aliases/expressions/type_script_type_aliases";
import type { CallableRuleAppender, RuleContextContract, TypeShapeCounts } from "src/types";
import type { TypeScriptTypeShapeRulesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _type-shape classification_, _unbounded type diagnostics_. **/
export class TypeScriptTypeShapeRules implements TypeScriptTypeShapeRulesContract {
	private readonly _data_member_kinds: Set<ts.SyntaxKind>;
	private readonly _type_aliases: TypeScriptTypeAliases;
	private readonly _callable_body: TypeScriptCallableBody;
	private readonly _unbounded_type_names: Set<string>;
	private readonly _unbounded_type_kinds: ReadonlySet<ts.SyntaxKind>;
	private readonly _callable_body_cache: WeakMap<ts.Node, boolean>;

	/** Responsibilities: _classification type member storage_. **/
	private is_data_member(data_member: ts.TypeElement): boolean {
		if (!this._data_member_kinds.has(data_member.kind)) {
			return false;
		}
		if (ts.isPropertySignature(data_member)) {
			return true;
		}
		return ts.isIndexSignatureDeclaration(data_member);
	}

	/** Responsibilities: _classification type member callable_. **/
	private is_callable_member(callable_member: ts.TypeElement): boolean {
		if (ts.isCallSignatureDeclaration(callable_member)) {
			return true;
		}
		if (ts.isMethodSignature(callable_member)) {
			return true;
		}
		return this.callable_property(callable_member);
	}

	/** Responsibilities: _callable data member count_. **/
	private count_shape_member(counts: TypeShapeCounts, member: ts.TypeElement): TypeShapeCounts {
		let callables = counts.callables;
		let data = counts.data;
		let methods = counts.methods;
		if (ts.isMethodSignature(member)) {
			methods += 1;
		}
		if (this.is_callable_member(member)) {
			callables += 1;
		} else if (this.is_data_member(member)) {
			data += 1;
		}
		return { callables, data, methods };
	}

	/** Responsibilities: _callable data member count_. **/
	private callable_shape_counts(node: ts.TypeAliasDeclaration): TypeShapeCounts {
		if (!ts.isTypeLiteralNode(node.type)) {
			return { callables: 0, data: 0, methods: 0 };
		}
		let counts: TypeShapeCounts = { callables: 0, data: 0, methods: 0 };
		for (const member of node.type.members) {
			counts = this.count_shape_member(counts, member);
		}
		return counts;
	}

	/** Responsibilities: _callable property signature classification_. **/
	private callable_property(property_member: ts.TypeElement): boolean {
		if (!ts.isPropertySignature(property_member)) {
			return false;
		}
		if (property_member.type === undefined) {
			return false;
		}
		return ts.isFunctionTypeNode(property_member.type);
	}

	/** Responsibilities: _callable-body membership lookup_. **/
	private in_callable_body(body_candidate: ts.Node): boolean {
		const cached = this._callable_body_cache.get(body_candidate);
		if (cached !== undefined) {
			return cached;
		}
		let current: ts.Node | undefined = body_candidate;
		while (current !== undefined && current.parent !== undefined) {
			const parent: ts.Node = current.parent;
			const body = this._callable_body.resolve<ts.Node | undefined>(parent, undefined, (candidate) => candidate);
			if (body === current) {
				this._callable_body_cache.set(body_candidate, true);
				return true;
			}
			current = parent;
		}
		this._callable_body_cache.set(body_candidate, false);
		return false;
	}

	/** Responsibilities: _classification node usage unbounded_. **/
	private is_unbounded_type(unbounded_candidate: ts.Node): boolean {
		if (unbounded_candidate.kind === ts.SyntaxKind.AnyKeyword) {
			return true;
		}
		if (unbounded_candidate.kind === ts.SyntaxKind.UnknownKeyword) {
			return true;
		}
		if (unbounded_candidate.kind === ts.SyntaxKind.ObjectKeyword) {
			return true;
		}
		if (!ts.isTypeReferenceNode(unbounded_candidate)) {
			return false;
		}
		const type_name = unbounded_candidate.typeName.getText();
		return this._unbounded_type_names.has(this._type_aliases.resolve(type_name));
	}

	/** Responsibilities: _interface-shape diagnostics_. **/
	private append_interface_shape(
		interface_candidate: ts.Node,
		test_file: boolean,
		append_rule: CallableRuleAppender,
	): void {
		if (test_file) {
			return;
		}
		if (!ts.isTypeAliasDeclaration(interface_candidate)) {
			return;
		}
		if (!ts.isTypeLiteralNode(interface_candidate.type)) {
			return;
		}
		const counts = this.callable_shape_counts(interface_candidate);
		const has_methods = counts.methods > 0;
		const callable_only = counts.callables > 3 && counts.data === 0;
		const empty_shape = counts.callables === 0 && counts.data === 0;
		if (has_methods || callable_only || empty_shape) {
			append_rule(interface_candidate, INTERFACE_RULE_ID);
		}
	}

	/** Responsibilities: _node type diagnostics_. **/
	private append_node_type(candidate: ts.Node, context: RuleContextContract): void {
		if (this._unbounded_type_kinds.has(candidate.kind)) {
			const alias_type =
				candidate.parent !== undefined &&
				ts.isTypeAliasDeclaration(candidate.parent) &&
				candidate.parent.type === candidate;
			if (this.is_unbounded_type(candidate) && (!this.in_callable_body(candidate) || alias_type)) {
				context.for_node(candidate).append_rule(UNBOUNDED_TYPE);
			}
		}
		if (ts.isIndexSignatureDeclaration(candidate)) {
			context.for_node(candidate).append_rule(INDEX_SIGNATURE);
		}
	}

	/** Responsibilities: _type-shape analysis initialization_. **/
	public constructor() {
		this._data_member_kinds = new Set([ts.SyntaxKind.PropertySignature, ts.SyntaxKind.IndexSignature]);
		this._type_aliases = new TypeScriptTypeAliases();
		this._callable_body = new TypeScriptCallableBody(TYPE_SCRIPT_CALLABLE_BODY_KINDS);
		this._unbounded_type_names = new Set(["any", "unknown", "object", "Object"]);
		this._unbounded_type_kinds = new Set([
			ts.SyntaxKind.AnyKeyword,
			ts.SyntaxKind.UnknownKeyword,
			ts.SyntaxKind.ObjectKeyword,
			ts.SyntaxKind.TypeReference,
		]);
		this._callable_body_cache = new WeakMap<ts.Node, boolean>();
	}

	/** Responsibilities: _type rule application_. **/
	public append_type_rules(candidate: ts.Node, context: RuleContextContract): void {
		const append_rule: CallableRuleAppender = (node, rule_id): void => {
			context.for_node(node).append_rule(rule_id);
		};
		if (candidate === context.state().source.source_file) {
			this._type_aliases.collect(context.state().source.source_file);
		}
		this.append_node_type(candidate, context);
		if (ts.isTypeAliasDeclaration(candidate)) {
			this.append_interface_shape(candidate, context.state().source.test_file, append_rule);
		}
	}
}
