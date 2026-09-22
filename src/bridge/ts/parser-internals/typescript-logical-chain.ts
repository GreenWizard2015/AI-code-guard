import ts from 'typescript';
import { CallableBodyMetrics } from 'src/model/typescript-callable-body-metrics';
import { MAX_CALLABLE_CHARACTERS } from 'src/constants';

/** Responsibilities: _measurement logical expression chains_. **/
export class TypeScriptLogicalChain {
	private readonly maximum_characters = MAX_CALLABLE_CHARACTERS;
	private readonly metrics_cache = new WeakMap<ts.SourceFile, CallableBodyMetrics>();

	/** Responsibilities: _creation source metrics logical-chain_. **/
	private metrics_for(source_file: ts.SourceFile): CallableBodyMetrics {
		const cached = this.metrics_cache.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const metrics = new CallableBodyMetrics(source_file);
		this.metrics_cache.set(source_file, metrics);
		return metrics;
	}
	/** Responsibilities: _classification binary node usage_. **/
	private logical_operator(node: ts.BinaryExpression): boolean {
		const kind = node.operatorToken.kind;
		if (kind === ts.SyntaxKind.AmpersandAmpersandToken) {
			return true;
		}
		if (kind === ts.SyntaxKind.BarBarToken) {
			return true;
		}
		return kind === ts.SyntaxKind.QuestionQuestionToken;
	}

	/** Responsibilities: _classification logical expression initialization_. **/
	private named_initializer(node: ts.BinaryExpression): boolean {
		let parent = node.parent;
		while (ts.isParenthesizedExpression(parent)) {
			parent = parent.parent;
		}
		return ts.isVariableDeclaration(parent) && parent.initializer === node;
	}

	/** Responsibilities: _classification logical expression nested_. **/
	private has_logical_parent(node: ts.BinaryExpression): boolean {
		let parent = node.parent;
		while (ts.isParenthesizedExpression(parent)) {
			parent = parent.parent;
		}
		return ts.isBinaryExpression(parent) && this.logical_operator(parent);
	}

	/** Responsibilities: _classification logical expression belongs_. **/
	private expression_lambda(node: ts.BinaryExpression): boolean {
		let parent = node.parent;
		while (parent !== undefined) {
			if (ts.isArrowFunction(parent)) {
				return !ts.isBlock(parent.body);
			}
			parent = parent.parent;
		}
		return false;
	}

	/** Responsibilities: _logical expression part count_. **/
	public logical_part_count(expression: ts.Expression): number {
		if (ts.isParenthesizedExpression(expression)) {
			return this.logical_part_count(expression.expression);
		}
		if (!ts.isBinaryExpression(expression)) {
			return 1;
		}
		if (!this.logical_operator(expression)) {
			return 1;
		}
		return this.logical_part_count(expression.left) + this.logical_part_count(expression.right);
	}

	/** Responsibilities: _reporting logical chains exceeding_. **/
	public long_chain(node: ts.Node): boolean {
		if (!ts.isBinaryExpression(node) || !this.logical_operator(node)) {
			return false;
		}
		if (this.named_initializer(node) || this.has_logical_parent(node) || this.expression_lambda(node)) {
			return false;
		}
		const too_many_parts = this.logical_part_count(node) > 3;
		const metrics = this.metrics_for(node.getSourceFile());
		const too_long = metrics.significant_characters(node.getText()) >= this.maximum_characters;
		return too_many_parts || too_long;
	}
}
