import { TYPESCRIPT_PROTOTYPE_NAME } from "src/constants";
import type { RuntimeAliasScopeContract, TypeScriptProxyExpressionsContract } from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _prototype alias state_, _prototype alias targets_. **/
export class RuntimeBuiltinAliasAnalysis {
	private readonly _scope: RuntimeAliasScopeContract;
	private readonly _proxy_expressions: TypeScriptProxyExpressionsContract;

	/** Responsibilities: _assignment alias matching_. **/
	private assignment_matches_alias(child: ts.BinaryExpression, name: string, scope: ts.Node): boolean {
		if (child.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return false;
		}
		if (!ts.isIdentifier(child.left) || child.left.text !== name) {
			return false;
		}
		return this._scope.contains(scope, child);
	}

	/** Responsibilities: _mutable alias assignment state_. **/
	private assignment_state(child: ts.Node, current_state: boolean, name: string, scope: ts.Node): boolean {
		if (!ts.isBinaryExpression(child)) {
			return current_state;
		}
		if (!this.assignment_matches_alias(child, name, scope)) {
			return current_state;
		}
		const assignment_targets_prototype = this._proxy_expressions.contains_property(
			child.right,
			TYPESCRIPT_PROTOTYPE_NAME,
		);
		if (!this._scope.conditional_write(child, scope)) {
			return assignment_targets_prototype;
		}
		if (current_state) {
			return true;
		}
		return assignment_targets_prototype;
	}

	/** Responsibilities: _declaration alias name_. **/
	private alias_name(declaration: ts.VariableDeclaration, usage: ts.Node): string {
		const declaration_list = declaration.parent;
		if (!ts.isVariableDeclarationList(declaration_list) || !this._scope.visible(declaration, usage)) {
			return "";
		}
		const initializer = declaration.initializer;
		if (initializer === undefined) {
			return "";
		}
		if ((declaration_list.flags & ts.NodeFlags.Const) !== 0) {
			return this.constant_alias_name(declaration.name.getText(), initializer);
		}
		if ((declaration_list.flags & ts.NodeFlags.Let) !== 0 && this.mutable_alias(declaration, usage)) {
			return declaration.name.getText();
		}
		return "";
	}

	/** Responsibilities: _constant prototype alias_. **/
	private constant_alias_name(variable_name: string, initializer: ts.Expression): string {
		if (!this._proxy_expressions.contains_property(initializer, TYPESCRIPT_PROTOTYPE_NAME)) {
			return "";
		}
		return variable_name;
	}

	/** Responsibilities: _prototype alias name collection_. **/
	private append_alias_names(node: ts.Node, usage: ts.Node, aliases: Set<string>): void {
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
			const name = this.alias_name(node, usage);
			if (name.length > 0) {
				aliases.add(name);
			}
		}
		ts.forEachChild(node, (child) => this.append_alias_names(child, usage, aliases));
	}

	/** Responsibilities: _prototype alias analysis initialization_. **/
	public constructor(scope: RuntimeAliasScopeContract, proxy_expressions: TypeScriptProxyExpressionsContract) {
		this._scope = scope;
		this._proxy_expressions = proxy_expressions;
	}

	/** Responsibilities: _mutable prototype alias_. **/
	public mutable_alias(declaration: ts.VariableDeclaration, mutation: ts.Node): boolean {
		const initializer = declaration.initializer;
		if (initializer === undefined) {
			return false;
		}
		const scope = this._scope.lexical_scope(declaration);
		const name = declaration.name.getText();
		let points_to_prototype = this._proxy_expressions.contains_property(initializer, TYPESCRIPT_PROTOTYPE_NAME);
		const visit = (child: ts.Node): void => {
			if (child === mutation || child.pos >= mutation.pos) {
				return;
			}
			points_to_prototype = this.assignment_state(child, points_to_prototype, name, scope);
			ts.forEachChild(child, visit);
		};
		visit(scope);
		return points_to_prototype;
	}

	/** Responsibilities: _prototype alias target_. **/
	public target(node: ts.Node, left_chain: readonly string[]): boolean {
		const aliases = new Set<string>();
		this.append_alias_names(node.getSourceFile(), node, aliases);
		return left_chain.some((name) => aliases.has(name));
	}
}
