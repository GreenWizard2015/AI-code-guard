import ts from "typescript";
import type { RuntimeAliasScopeContract, TypeScriptProxyExpressionsContract } from "src/typescript_analysis_protocols";
import { TYPESCRIPT_PROTOTYPE_NAME } from "src/constants";

/** Responsibilities: _prototype alias state_, _prototype alias targets_. **/
export class PrototypeAliasAnalysis {
	private readonly scope: RuntimeAliasScopeContract;

	/** Responsibilities: _assignment alias matching_. **/
	private assignment_matches_alias(child: ts.BinaryExpression, name: string, scope: ts.Node): boolean {
		if (child.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return false;
		}
		if (!ts.isIdentifier(child.left) || child.left.text !== name) {
			return false;
		}
		return this.scope.contains(scope, child);
	}

	/** Responsibilities: _mutable alias assignment state_. **/
	private assignment_state(
		child: ts.Node,
		current_state: boolean,
		name: string,
		scope: ts.Node,
		proxy_expressions: TypeScriptProxyExpressionsContract,
	): boolean {
		if (!ts.isBinaryExpression(child)) {
			return current_state;
		}
		if (!this.assignment_matches_alias(child, name, scope)) {
			return current_state;
		}
		const assignment_targets_prototype = proxy_expressions.contains_property(child.right, TYPESCRIPT_PROTOTYPE_NAME);
		if (!this.scope.conditional_write(child, scope)) {
			return assignment_targets_prototype;
		}
		if (current_state) {
			return true;
		}
		return assignment_targets_prototype;
	}

	/** Responsibilities: _constant prototype alias name_. **/
	private constant_alias_name(
		declaration: ts.VariableDeclaration,
		initializer: ts.Expression,
		proxy_expressions: TypeScriptProxyExpressionsContract,
	): string {
		if (!proxy_expressions.contains_property(initializer, TYPESCRIPT_PROTOTYPE_NAME)) {
			return "";
		}
		return declaration.name.getText();
	}

	/** Responsibilities: _mutable prototype alias name_. **/
	private mutable_alias_name(
		declaration: ts.VariableDeclaration,
		usage: ts.Node,
		proxy_expressions: TypeScriptProxyExpressionsContract,
	): string {
		const declaration_list = declaration.parent;
		if (!ts.isVariableDeclarationList(declaration_list)) {
			return "";
		}
		if ((declaration_list.flags & ts.NodeFlags.Let) === 0) {
			return "";
		}
		const name = declaration.name.getText();
		if (this.mutable_alias(declaration, usage, name, proxy_expressions)) {
			return name;
		}
		return "";
	}

	/** Responsibilities: _declaration alias name_. **/
	private alias_name(
		declaration: ts.VariableDeclaration,
		usage: ts.Node,
		proxy_expressions: TypeScriptProxyExpressionsContract,
	): string {
		const declaration_list = declaration.parent;
		if (!ts.isVariableDeclarationList(declaration_list) || !this.scope.visible(declaration, usage)) {
			return "";
		}
		const initializer = declaration.initializer;
		if (initializer === undefined) {
			return "";
		}
		if ((declaration_list.flags & ts.NodeFlags.Const) !== 0) {
			return this.constant_alias_name(declaration, initializer, proxy_expressions);
		}
		return this.mutable_alias_name(declaration, usage, proxy_expressions);
	}

	/** Responsibilities: _prototype alias name collection_. **/
	private append_alias_names(
		node: ts.Node,
		usage: ts.Node,
		proxy_expressions: TypeScriptProxyExpressionsContract,
		aliases: Set<string>,
	): void {
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
			const name = this.alias_name(node, usage, proxy_expressions);
			if (name.length > 0) {
				aliases.add(name);
			}
		}
		ts.forEachChild(node, (child) => this.append_alias_names(child, usage, proxy_expressions, aliases));
	}

	/** Responsibilities: _prototype alias analysis initialization_. **/
	public constructor(scope: RuntimeAliasScopeContract) {
		this.scope = scope;
	}

	/** Responsibilities: _mutable prototype alias_. **/
	public mutable_alias(
		declaration: ts.VariableDeclaration,
		mutation: ts.Node,
		name: string,
		proxy_expressions: TypeScriptProxyExpressionsContract,
	): boolean {
		const initializer = declaration.initializer;
		if (initializer === undefined) {
			return false;
		}
		const scope = this.scope.lexical_scope(declaration);
		let points_to_prototype = proxy_expressions.contains_property(initializer, TYPESCRIPT_PROTOTYPE_NAME);
		const visit = (child: ts.Node): void => {
			if (child === mutation || child.pos >= mutation.pos) {
				return;
			}
			points_to_prototype = this.assignment_state(child, points_to_prototype, name, scope, proxy_expressions);
			ts.forEachChild(child, visit);
		};
		visit(scope);
		return points_to_prototype;
	}

	/** Responsibilities: _prototype alias target_. **/
	public target(
		node: ts.Node,
		left_chain: readonly string[],
		proxy_expressions: TypeScriptProxyExpressionsContract,
	): boolean {
		const aliases = new Set<string>();
		this.append_alias_names(node.getSourceFile(), node, proxy_expressions, aliases);
		return left_chain.some((name) => aliases.has(name));
	}
}
