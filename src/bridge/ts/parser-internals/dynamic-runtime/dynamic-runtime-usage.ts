import ts from "typescript";
import type { RuleContextData } from "src/types";
import { DYNAMIC_RUNTIME_USAGE } from "src/bridge/ts/parser-internals/constants";
import { DynamicBindingNames } from "src/bridge/ts/parser-internals/dynamic-runtime/dynamic-binding-names";
import { TypeScriptInOperatorAliases } from "src/bridge/ts/parser-internals/dynamic-runtime/typescript-in-operator-aliases";
import { TypeScriptConditionExpression } from "src/bridge/ts/parser-internals/typescript-condition-expression";
import { DynamicRuntimeMembers } from "src/bridge/ts/parser-internals/dynamic-runtime/dynamic-runtime-members";

/** Responsibilities: _detection dynamic runtime access_. **/
export class DynamicRuntimeUsage {
	private readonly binding_names = new DynamicBindingNames();
	private readonly in_operator_aliases = new TypeScriptInOperatorAliases(this.binding_names);
	private readonly condition_expression = new TypeScriptConditionExpression();
	private readonly member_usage = new DynamicRuntimeMembers();

	/** Responsibilities: _conditional in-operator usage_. **/
	private condition_in_operator(expression: ts.Expression, node: ts.Node, source_file: ts.SourceFile): boolean {
		if (ts.isBinaryExpression(expression)) {
			return this.in_operator_aliases.invalid(expression, source_file);
		}
		if (ts.isIdentifier(expression)) {
			return this.in_operator_aliases.aliases(node).has(expression.text);
		}
		return false;
	}

	/** Responsibilities: _dynamic in-operator usage identification_. **/
	public in_operator(node: ts.Node, source_file: ts.SourceFile): boolean {
		if (ts.isIfStatement(node)) {
			const expression = this.condition_expression.unwrap(node.expression);
			return this.condition_in_operator(expression, node, source_file);
		}
		if (!ts.isBinaryExpression(node)) {
			if (!ts.isIdentifier(node)) {
				return false;
			}
			return this.in_operator_aliases.aliases(node).has(node.text);
		}
		const expression = this.condition_expression.unwrap(node);
		return this.condition_in_operator(expression, node, source_file);
	}

	/** Responsibilities: _dynamic runtime usage identification_. **/
	public dynamic(node: ts.Node, source_file: ts.SourceFile): boolean {
		if (this.binding_names.dynamic_key(node, source_file)) {
			return true;
		}
		return this.member_usage.matches(node);
	}

	/** Responsibilities: _dynamic runtime rules addition_. **/
	public append_rule(node: ts.Node, context: RuleContextData): void {
		if (this.dynamic(node, context.source_file)) {
			context.append_rule(node, DYNAMIC_RUNTIME_USAGE);
		}
	}
}
