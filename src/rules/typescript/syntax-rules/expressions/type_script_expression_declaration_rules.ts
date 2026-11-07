import { RULE_IDS } from "src/linting/constants";
import { OVERLOAD } from "src/parser/internals/constants";
import { TypeScriptOverloadRules } from "src/rules/typescript/syntax-rules/callables/type_script_overload_rules";
import type { CallableRuleAppender } from "src/types";
import type { TypeScriptExpressionRuleContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _callable declaration rules_, _explicit return requirements_. **/
export class TypeScriptExpressionDeclarationRules implements TypeScriptExpressionRuleContract {
	private readonly _overload_rules: TypeScriptOverloadRules;
	private readonly _return_type_kinds: ReadonlySet<ts.SyntaxKind>;
	private readonly _variable_return_kinds: ReadonlySet<ts.SyntaxKind>;

	/** Responsibilities: _callable parent resolution_. **/
	private callable_parent(node: ts.FunctionLikeDeclaration): ts.Node {
		let child: ts.Node = node;
		let parent = node.parent;
		while (!ts.isSourceFile(parent)) {
			if (ts.isVariableDeclaration(parent) || ts.isFunctionLike(parent)) {
				return parent;
			}
			if ((ts.isCallExpression(parent) || ts.isNewExpression(parent)) && parent.expression !== child) {
				return parent;
			}
			child = parent;
			parent = parent.parent;
		}
		return parent;
	}

	/** Responsibilities: _callback return annotation_. **/
	private missing_variable_return(node: ts.FunctionLikeDeclaration): boolean {
		if (!this._variable_return_kinds.has(node.kind)) {
			return false;
		}
		const parent = this.callable_parent(node);
		if (!ts.isVariableDeclaration(parent)) {
			return false;
		}
		if (!ts.isIdentifier(parent.name) || parent.type !== undefined) {
			return false;
		}
		return node.type === undefined;
	}

	/** Responsibilities: _missing callable result annotation_. **/
	private missing_return(node: ts.SignatureDeclaration): boolean {
		switch (node.kind) {
			case ts.SyntaxKind.FunctionDeclaration:
			case ts.SyntaxKind.MethodDeclaration:
			case ts.SyntaxKind.GetAccessor:
			case ts.SyntaxKind.MethodSignature:
				return node.type === undefined;
			case ts.SyntaxKind.ArrowFunction:
			case ts.SyntaxKind.FunctionExpression:
				return (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && this.missing_variable_return(node);
			default:
				return false;
		}
	}

	/** Responsibilities: _overload declaration classification_. **/
	private overloaded_declaration(node: ts.Node): boolean {
		if (ts.isFunctionDeclaration(node)) {
			return this._overload_rules.function_overload(node);
		}
		if (ts.isMethodDeclaration(node)) {
			return this._overload_rules.class_method_overload(node);
		}
		if (ts.isMethodSignature(node)) {
			return this._overload_rules.interface_method_overload(node);
		}
		return false;
	}

	/** Responsibilities: _explicit callable result reporting_. **/
	private append_return_rule(node: ts.SignatureDeclaration, append_rule: CallableRuleAppender): void {
		if (this.missing_return(node)) {
			append_rule(node, RULE_IDS.explicit_return_type);
		}
	}

	/** Responsibilities: _callable declaration analyzer initialization_. **/
	public constructor() {
		this._overload_rules = new TypeScriptOverloadRules();
		this._variable_return_kinds = new Set([ts.SyntaxKind.ArrowFunction, ts.SyntaxKind.FunctionExpression]);
		this._return_type_kinds = new Set([
			ts.SyntaxKind.FunctionDeclaration,
			ts.SyntaxKind.MethodDeclaration,
			ts.SyntaxKind.GetAccessor,
			ts.SyntaxKind.MethodSignature,
			ts.SyntaxKind.ArrowFunction,
			ts.SyntaxKind.FunctionExpression,
		]);
	}

	/** Responsibilities: _callable declaration rule collection_. **/
	public append(node: ts.Node, append_rule: CallableRuleAppender): void {
		if (this.overloaded_declaration(node)) {
			append_rule(node, OVERLOAD);
		}
		if (this._return_type_kinds.has(node.kind) && ts.isFunctionLike(node)) {
			this.append_return_rule(node, append_rule);
		}
	}
}
