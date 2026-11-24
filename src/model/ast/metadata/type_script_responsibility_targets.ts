import { MODULE_INTERFACE_KIND } from "src/constants";
import { CONSTRUCTOR_NAME, METRIC_KIND_FUNCTION } from "src/metrics/constants";
import type { AstResponsibilityKind, AstResponsibilityTarget } from "src/model/ast/normalized_ast_types";
import { RESPONSIBILITY_CONTAINER_KIND } from "src/model/types";
import type { ResponsibilityContainer } from "src/model/types";
import type { TypeScriptResponsibilityTargetsContract } from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _responsibility documentation extraction_, _AST target collection_. **/
export class TypeScriptResponsibilityTargets implements TypeScriptResponsibilityTargetsContract {
	private readonly _source_file: ts.SourceFile;
	private readonly _root_container: ResponsibilityContainer;
	private readonly _method_kinds: Set<ts.SyntaxKind>;
	/** Responsibilities: _TypeScript documentation access_. **/
	private documentation(documented_node: ts.Node): string {
		const comments = ts.getJSDocCommentsAndTags(documented_node);
		const documentation = comments.find((comment) => comment.kind === ts.SyntaxKind.JSDoc);
		if (documentation === undefined) {
			return "";
		}
		return documentation.getText(this._source_file);
	}

	/** Responsibilities: _TypeScript responsibility targets collection_. **/
	private target(kind: AstResponsibilityKind, name: string, target_node: ts.Node): AstResponsibilityTarget {
		return {
			kind,
			name,
			line: this._source_file.getLineAndCharacterOfPosition(target_node.getStart(this._source_file)).line,
			documentation: this.documentation(target_node),
		};
	}

	/** Responsibilities: _declaration names identification_. **/
	private declaration_name(node: ts.NamedDeclaration): string {
		if (node.name === undefined) {
			return "";
		}
		return node.name.getText(this._source_file);
	}

	/** Responsibilities: _declaration names identification_. **/
	private method_name(method_member: ts.Node): string {
		if (ts.isConstructorDeclaration(method_member)) {
			return CONSTRUCTOR_NAME;
		}
		if (ts.isMethodDeclaration(method_member)) {
			return this.declaration_name(method_member);
		}
		if (ts.isGetAccessorDeclaration(method_member)) {
			return this.declaration_name(method_member);
		}
		if (ts.isSetAccessorDeclaration(method_member)) {
			return this.declaration_name(method_member);
		}
		if (ts.isMethodSignature(method_member)) {
			return this.declaration_name(method_member);
		}
		return "";
	}

	/** Responsibilities: _TypeScript responsibility targets collection_. **/
	private append_method(
		method_targets: AstResponsibilityTarget[],
		method_candidate: ts.Node,
		container: ResponsibilityContainer,
	): void {
		if (container.kind === RESPONSIBILITY_CONTAINER_KIND.Interface && ts.isMethodSignature(method_candidate)) {
			return;
		}
		const name = this.method_name(method_candidate);
		if (!name) {
			return;
		}
		method_targets.push(this.target("method", name, method_candidate));
	}

	/** Responsibilities: _TypeScript responsibility targets collection_. **/
	private append_class(class_declaration: ts.ClassDeclaration, class_targets: AstResponsibilityTarget[]): boolean {
		if (class_declaration.name === undefined) {
			return true;
		}
		const current: ResponsibilityContainer = {
			kind: RESPONSIBILITY_CONTAINER_KIND.Class,
			line: this._source_file.getLineAndCharacterOfPosition(class_declaration.getStart(this._source_file)).line,
		};
		class_targets.push(this.target("class", class_declaration.name.text, class_declaration));
		for (const member of class_declaration.members) {
			this.visit(member, class_targets, current);
		}
		return true;
	}

	/** Responsibilities: _TypeScript responsibility targets collection_. **/
	private append_interface(
		interface_declaration: ts.InterfaceDeclaration,
		interface_targets: AstResponsibilityTarget[],
	): boolean {
		const current: ResponsibilityContainer = {
			kind: RESPONSIBILITY_CONTAINER_KIND.Interface,
			line: this._source_file.getLineAndCharacterOfPosition(interface_declaration.getStart(this._source_file)).line,
		};
		interface_targets.push(this.target(MODULE_INTERFACE_KIND, interface_declaration.name.text, interface_declaration));
		for (const member of interface_declaration.members) {
			this.visit(member, interface_targets, current);
		}
		return true;
	}

	/** Responsibilities: _TypeScript responsibility targets collection_. **/
	private append_function(
		function_declaration: ts.FunctionDeclaration,
		function_targets: AstResponsibilityTarget[],
	): boolean {
		if (function_declaration.name !== undefined) {
			function_targets.push(this.target(METRIC_KIND_FUNCTION, function_declaration.name.text, function_declaration));
		}
		return true;
	}

	/** Responsibilities: _TypeScript responsibility targets collection_. **/
	private append_variable(
		variable_declaration: ts.VariableDeclaration,
		variable_targets: AstResponsibilityTarget[],
	): boolean {
		if (variable_declaration.initializer === undefined) {
			return true;
		}
		if (ts.isArrowFunction(variable_declaration.initializer)) {
			variable_targets.push(
				this.target(METRIC_KIND_FUNCTION, variable_declaration.name.getText(this._source_file), variable_declaration),
			);
			return true;
		}
		if (ts.isFunctionExpression(variable_declaration.initializer)) {
			variable_targets.push(
				this.target(METRIC_KIND_FUNCTION, variable_declaration.name.getText(this._source_file), variable_declaration),
			);
		}
		return true;
	}

	/** Responsibilities: _TypeScript declarations classification_. **/
	private append_declaration(declaration_candidate: ts.Node, declaration_targets: AstResponsibilityTarget[]): boolean {
		if (ts.isClassDeclaration(declaration_candidate)) {
			return this.append_class(declaration_candidate, declaration_targets);
		}
		if (ts.isInterfaceDeclaration(declaration_candidate)) {
			return this.append_interface(declaration_candidate, declaration_targets);
		}
		if (ts.isTypeAliasDeclaration(declaration_candidate)) {
			return true;
		}
		if (ts.isFunctionDeclaration(declaration_candidate)) {
			return this.append_function(declaration_candidate, declaration_targets);
		}
		if (ts.isVariableDeclaration(declaration_candidate)) {
			return this.append_variable(declaration_candidate, declaration_targets);
		}
		return false;
	}

	/** Responsibilities: _TypeScript responsibility targets collection_. **/
	private visit(
		visited_node: ts.Node,
		traversal_targets: AstResponsibilityTarget[],
		container: ResponsibilityContainer,
	): void {
		if (container.kind !== RESPONSIBILITY_CONTAINER_KIND.Root && this._method_kinds.has(visited_node.kind)) {
			this.append_method(traversal_targets, visited_node, container);
			return;
		}
		if (this.append_declaration(visited_node, traversal_targets)) {
			return;
		}
		ts.forEachChild(visited_node, (child) => this.visit(child, traversal_targets, this._root_container));
	}

	/** Responsibilities: _TypeScript responsibility targets collection_. **/
	public constructor(source_file: ts.SourceFile) {
		this._root_container = { kind: RESPONSIBILITY_CONTAINER_KIND.Root, line: 0 };
		this._method_kinds = new Set([
			ts.SyntaxKind.MethodDeclaration,
			ts.SyntaxKind.Constructor,
			ts.SyntaxKind.GetAccessor,
			ts.SyntaxKind.SetAccessor,
			ts.SyntaxKind.MethodSignature,
		]);
		this._source_file = source_file;
	}

	/** Responsibilities: _TypeScript responsibility targets collection_. **/
	public collect(): AstResponsibilityTarget[] {
		return this.collect_nodes(this._source_file.statements);
	}

	/** Responsibilities: _TypeScript responsibility targets collection_. **/
	public collect_nodes(nodes: readonly ts.Node[]): AstResponsibilityTarget[] {
		const targets: AstResponsibilityTarget[] = [];
		for (const node of nodes) {
			this.visit(node, targets, this._root_container);
		}
		return targets;
	}
}
