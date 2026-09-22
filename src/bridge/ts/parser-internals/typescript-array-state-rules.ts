import ts from 'typescript';
import type { RuleContextData } from 'src/types';
import { SINGLE_ARRAY_STATE } from 'src/bridge/ts/parser-internals/constants';
import { TypeScriptArrayStateInspector } from 'src/bridge/ts/parser-internals/type-union-rules/array-state-inspector';

/** Responsibilities: _detection zero-index array access_. **/
export class TypeScriptArrayStateRules {
	private readonly array_rule_id = SINGLE_ARRAY_STATE;
	private readonly inspector = new TypeScriptArrayStateInspector();
	private readonly strict_undefined_operators = new Set([
		ts.SyntaxKind.ExclamationEqualsEqualsToken,
		ts.SyntaxKind.EqualsEqualsEqualsToken,
	]);

	/** Responsibilities: _resolution name guarded against_. **/
	private undefined_guard_name(expression: ts.Expression): string {
		if (!ts.isBinaryExpression(expression)) {
			return '';
		}
		if (!this.strict_undefined_operators.has(expression.operatorToken.kind)) {
			return '';
		}
			if (ts.isIdentifier(expression.left)) {
				if (expression.right.getText() === 'undefined') {
				return expression.left.text;
				}
			}
		if (ts.isIdentifier(expression.right)) {
			if (expression.left.getText() === 'undefined') {
				return expression.right.text;
			}
		}
		return '';
	}

	/** Responsibilities: _classification statement assigns zero-index_. **/
	private zero_index_assignment(statement: ts.Statement, name: string): boolean {
		if (!ts.isVariableStatement(statement)) {
			return false;
		}
		return statement.declarationList.declarations.some(declaration => {
				if (!ts.isIdentifier(declaration.name)) {
					return false;
				}
				if (declaration.name.text !== name) {
					return false;
			}
			const initializer = declaration.initializer;
				if (initializer === undefined) {
					return false;
				}
				if (!ts.isElementAccessExpression(initializer)) {
				return false;
			}
			const argument = initializer.argumentExpression;
			return argument !== undefined && argument.getText() === '0';
		});
	}

	/** Responsibilities: _classification node guards zero-index_. **/
	private zero_index_guard(node: ts.Node): boolean {
		if (!ts.isIfStatement(node) || !ts.isBlock(node.parent)) {
			return false;
		}
		const name = this.undefined_guard_name(node.expression);
		if (name.length === 0) {
			return false;
		}
		const position = node.parent.statements.indexOf(node);
		if (position === 0) {
			return false;
		}
		const previous = node.parent.statements[position - 1];
		if (previous === undefined) {
			return false;
		}
		return this.zero_index_assignment(previous, name);
	}

	/** Responsibilities: _reporting node accesses array_. **/
	public array_access(node: ts.Node, source_file: ts.SourceFile): boolean {
		if (!ts.isElementAccessExpression(node)) {
			return false;
		}
		if (!ts.isCallExpression(node.expression)) {
			return false;
		}
		return this.inspector.single_item_access(node, source_file);
	}

	/** Responsibilities: _aggregation single-item array-state diagnostics_. **/
	public append(node: ts.Node, context: RuleContextData): void {
if (this.array_access(node, context.source_file) || this.zero_index_guard(node)) {
			context.append_rule(node, this.array_rule_id);
		}
	}
}
