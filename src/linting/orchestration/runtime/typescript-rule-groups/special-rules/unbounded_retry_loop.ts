import ts from "typescript";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ViolationContract } from "src/protocols";

/** Responsibilities: _attempt limits_, _termination states_. **/
export class UnboundedRetryLoop {
	private readonly rule: DiagnosticRule;

	/** Responsibilities: _nested boundary detection_. **/
	private nested_boundary(current: ts.Node, root: ts.Node): boolean {
		if (current === root) {
			return false;
		}
		if (ts.isFunctionLike(current)) {
			return true;
		}
		return ts.isWhileStatement(current) || ts.isForStatement(current);
	}

	/** Responsibilities: _invocation detection_. **/
	private contains_call(node: ts.Node): boolean {
		let found = false;
		const visit = (current: ts.Node): void => {
			if (found) {
				return;
			}
			if (this.nested_boundary(current, node)) {
				return;
			}
			if (ts.isCallExpression(current)) {
				found = true;
				return;
			}
			current.forEachChild(visit);
		};
		visit(node);
		return found;
	}

	/** Responsibilities: _continuation detection_. **/
	private contains_continue(node: ts.Node): boolean {
		let found = false;
		const visit = (current: ts.Node): void => {
			if (found) {
				return;
			}
			if (this.nested_boundary(current, node)) {
				return;
			}
			if (ts.isContinueStatement(current)) {
				found = true;
				return;
			}
			current.forEachChild(visit);
		};
		visit(node);
		return found;
	}

	/** Responsibilities: _try continuation detection_. **/
	private try_contains_continue(node: ts.TryStatement): boolean {
		if (!this.contains_call(node.tryBlock)) {
			return false;
		}
		const catch_clause = node.catchClause;
		if (catch_clause === undefined) {
			return false;
		}
		return this.contains_continue(catch_clause.block);
	}

	/** Responsibilities: _attempt detection_. **/
	private has_unbounded_retry(node: ts.WhileStatement): boolean {
		let found = false;
		const visit = (current: ts.Node): void => {
			if (found) {
				return;
			}
			if (this.nested_boundary(current, node)) {
				return;
			}
			if (ts.isTryStatement(current)) {
				if (this.try_contains_continue(current)) {
					found = true;
					return;
				}
			}
			current.forEachChild(visit);
		};
		visit(node.statement);
		return found;
	}

	/** Responsibilities: _attempt initialization_. **/
	public constructor() {
		this.rule = new DiagnosticRule("retry-without-ownership");
	}

	/** Responsibilities: _loop rule_. **/
	public retry_detection(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		node: ts.Node,
	): void {
		if (!ts.isWhileStatement(node)) {
			return;
		}
		if (!this.retry_loop_present(node)) {
			return;
		}
		violations.push(
			this.rule.violation(file, source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line + 1),
		);
	}

	/** Responsibilities: _attempt candidate detection_. **/
	public retry_loop_present(node: ts.WhileStatement): boolean {
		if (node.expression.kind !== ts.SyntaxKind.TrueKeyword) {
			return false;
		}
		return this.has_unbounded_retry(node);
	}
}
