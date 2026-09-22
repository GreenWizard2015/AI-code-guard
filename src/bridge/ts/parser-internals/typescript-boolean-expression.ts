import { TypeScriptBooleanCall } from 'src/bridge/ts/parser-internals/typescript-boolean-call';
import ts from 'typescript';
import {
	BOOLEAN_OPERATOR_KINDS,
	COMPARISON_OPERATOR_KINDS,
} from 'src/bridge/ts/parser-internals/constants';

/** Responsibilities: _resolution boolean properties declarations_. **/
export class TypeScriptBooleanExpression {
	private readonly boolean_call = new TypeScriptBooleanCall();
	private readonly comparison_operator_kinds = COMPARISON_OPERATOR_KINDS;
	private readonly boolean_operator_kinds = BOOLEAN_OPERATOR_KINDS;

	/** Responsibilities: _classification named property boolean-typed_. **/
	private boolean_property(name: string, source_file: ts.SourceFile): boolean {
		let result = false;
		const visit = (child: ts.Node): void => {
			if (result) {
				return;
			}
			if (!ts.isPropertyDeclaration(child) && !ts.isPropertySignature(child)) {
				ts.forEachChild(child, visit);
				return;
			}
			if (child.name.getText(source_file) !== name) {
				ts.forEachChild(child, visit);
				return;
			}
			if (child.type?.kind === ts.SyntaxKind.BooleanKeyword) {
				result = true;
				return;
			}
			ts.forEachChild(child, visit);
		};
		visit(source_file);
		return result;
	}

	/** Responsibilities: _classification complex expression resolution_. **/
	private boolean_complex_expression(node: ts.Expression, source_file: ts.SourceFile): boolean {
		if (ts.isBinaryExpression(node)) {
			return this.boolean_binary_expression(node, source_file);
		}
		if (ts.isIdentifier(node)) {
			return this.boolean_binding(node.text, source_file);
		}
		if (ts.isPropertyAccessExpression(node)) {
			return this.boolean_property(node.name.text, source_file);
		}
		if (ts.isCallExpression(node)) {
			return this.boolean_call.boolean_call(node, source_file);
		}
		return false;
	}

	/** Responsibilities: _classification binary expression boolean_. **/
	private boolean_binary_expression(
		node: ts.BinaryExpression,
		source_file: ts.SourceFile
	): boolean {
		if (this.comparison_operator_kinds.includes(node.operatorToken.kind)) {
			return true;
		}
		if (!this.boolean_operator_kinds.includes(node.operatorToken.kind)) {
			return false;
		}
		if (!this.boolean_expression(node.left, source_file)) {
			return false;
		}
		return this.boolean_expression(node.right, source_file);
	}

	/** Responsibilities: _classification binding resolution boolean_. **/
	private boolean_binding(name: string, source_file: ts.SourceFile): boolean {
		for (const statement of source_file.statements) {
			if (!ts.isVariableStatement(statement)) {
				continue;
			}
			for (const declaration of statement.declarationList.declarations) {
				if (this.boolean_declaration(declaration, name, source_file)) {
					return true;
				}
			}
		}
		return false;
	}

	/** Responsibilities: _classification declaration establishes boolean_. **/
	private boolean_declaration(
		declaration: ts.VariableDeclaration,
		name: string,
		source_file: ts.SourceFile
	): boolean {
		if (!ts.isIdentifier(declaration.name)) {
			return false;
		}
		if (declaration.name.text !== name) {
			return false;
		}
		if (declaration.type?.kind === ts.SyntaxKind.BooleanKeyword) {
			return true;
		}
		if (declaration.initializer === undefined) {
			return false;
		}
		return this.boolean_expression(declaration.initializer, source_file);
	}

	/** Responsibilities: _reporting boolean expression_. **/
	public boolean_expression(node: ts.Expression, source_file: ts.SourceFile): boolean {
		if (ts.isParenthesizedExpression(node)) {
			return this.boolean_expression(node.expression, source_file);
		}
		if (node.kind === ts.SyntaxKind.TrueKeyword) {
			return true;
		}
		if (node.kind === ts.SyntaxKind.FalseKeyword) {
			return true;
		}
		if (ts.isPrefixUnaryExpression(node)) {
			if (node.operator !== ts.SyntaxKind.ExclamationToken) {
				return false;
			}
			return true;
		}
		return this.boolean_complex_expression(node, source_file);
	}

	/** Responsibilities: _reporting binary expression usage_. **/
	public logical_operator(node: ts.BinaryExpression): boolean {
		const kind = node.operatorToken.kind;
		if (kind === ts.SyntaxKind.AmpersandAmpersandToken) {
			return true;
		}
		if (kind === ts.SyntaxKind.BarBarToken) {
			return true;
		}
		return kind === ts.SyntaxKind.QuestionQuestionToken;
	}

}
