import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { MetricViolations } from "src/metrics/metric_violations";
import type { LineDepth } from "src/model/ast/normalized_ast_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { RuleContextContract } from "src/types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _property-chain depth_, _attribute-depth diagnostics_. **/
export class TypeScriptAttributeDepthRules implements ASTSourceRuleContract {
	/** Responsibilities: _nested property count_. **/
	private depth(node: ts.PropertyAccessExpression): number {
		let depth = 2;
		let expression = node.expression;
		while (ts.isPropertyAccessExpression(expression)) {
			depth += 1;
			expression = expression.expression;
		}
		return depth;
	}

	/** Responsibilities: _attribute-depth diagnostic reporting_. **/
	private append_depth_violation(node: ts.PropertyAccessExpression, context: RuleContextContract, depth: number): void {
		const source_file = node.getSourceFile();
		const line = source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line;
		const violation: LineDepth = { line, depth };
		const violations: ViolationContract[] = [];
		const metrics = new MetricViolations(violations, context.state().source.file);
		metrics.append_depth_violations([violation]);
		for (const item of violations) {
			context.append_violation(item);
		}
	}

	/** Responsibilities: _attribute rule activation_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}

	/** Responsibilities: _property access dispatch_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		const node = request.node;
		if (!ts.isPropertyAccessExpression(node) || ts.isPropertyAccessExpression(node.parent)) {
			return;
		}
		const depth = this.depth(node);
		if (depth <= 4) {
			return;
		}
		this.append_depth_violation(node, request.context, depth);
	}
}
