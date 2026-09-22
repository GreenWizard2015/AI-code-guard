import ts from 'typescript';
import type { RuleContextData } from 'src/types';
import { REST_UNION_CONTRACT } from 'src/bridge/ts/parser-internals/constants';

/** Responsibilities: _rest-parameter unions identification_, _contract violations addition_. **/
export class RestUnionContractRule {
	private readonly rule_id = REST_UNION_CONTRACT;
	private readonly union_kind = ts.SyntaxKind.UnionType;

	/** Responsibilities: _node subtree union search_. **/
	private contains_union(node: ts.Node): boolean {
		if (node.kind === this.union_kind) {
			return true;
		}
		let found = false;
		node.forEachChild(child => {
			if (!found && this.contains_union(child)) {
				found = true;
			}
		});
		return found;
	}

	/** Responsibilities: _typed rest parameters identification_. **/
	public rest_parameter(node: ts.Node): boolean {
		if (!ts.isParameter(node)) {
			return false;
		}
		if (node.dotDotDotToken === undefined) {
			return false;
		}
		return node.type !== undefined;
	}

	/** Responsibilities: _aggregation rest-union contract violation_. **/
	public append_rule(node: ts.Node, context: RuleContextData): void {
		if ((!this.rest_parameter(node)) || (!ts.isParameter(node)) || node.type === undefined) {
			return;
		}
		if (this.contains_union(node.type)) {
			context.append_rule(node, this.rule_id);
		}
	}
}
