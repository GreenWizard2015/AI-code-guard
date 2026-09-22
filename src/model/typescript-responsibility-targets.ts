import ts from 'typescript';
import type { AstResponsibilityKind, AstResponsibilityTarget } from 'src/types';
import { ResponsibilityContainerKind } from 'src/model/types';
import type { ResponsibilityContainer } from 'src/model/types';

/** Responsibilities: _collection TypeScript responsibility targets_. **/
export class TypeScriptResponsibilityTargets {
	private readonly source_file: ts.SourceFile;
	private readonly root_container: ResponsibilityContainer = { kind: ResponsibilityContainerKind.Root, line: 0 };
	private readonly method_kinds = new Set([
		ts.SyntaxKind.MethodDeclaration,
		ts.SyntaxKind.Constructor,
		ts.SyntaxKind.GetAccessor,
		ts.SyntaxKind.SetAccessor,
		ts.SyntaxKind.MethodSignature,
	]);
	/** Responsibilities: _TypeScript documentation access_. **/
	private documentation(node: ts.Node): string {
		const comments = ts.getJSDocCommentsAndTags(node);
		const documentation = comments.find(comment => comment.kind === ts.SyntaxKind.JSDoc);
		if (documentation === undefined) {
			return '';
		}
		return documentation.getText(this.source_file);
	}

	/** Responsibilities: _TypeScript responsibility targets collection_. **/
	private target(
		kind: AstResponsibilityKind,
		name: string,
		node: ts.Node,
	): AstResponsibilityTarget {
		return {
			kind,
			name,
			line: this.source_file.getLineAndCharacterOfPosition(node.getStart(this.source_file)).line,
			documentation: this.documentation(node),
		};
	}

	/** Responsibilities: _declaration names identification_. **/
	private declaration_name(node: ts.NamedDeclaration): string {
		if (node.name === undefined) {
			return '';
		}
		return node.name.getText(this.source_file);
	}

	/** Responsibilities: _declaration names identification_. **/
	private method_name(node: ts.Node): string {
		if (ts.isConstructorDeclaration(node)) {
			return 'constructor';
		}
		if (ts.isMethodDeclaration(node)) {
			return this.declaration_name(node);
		}
		if (ts.isGetAccessorDeclaration(node)) {
			return this.declaration_name(node);
		}
		if (ts.isSetAccessorDeclaration(node)) {
			return this.declaration_name(node);
		}
		if (ts.isMethodSignature(node)) {
			return this.declaration_name(node);
		}
		return '';
	}

	/** Responsibilities: _TypeScript responsibility targets collection_. **/
	private append_method(
		targets: AstResponsibilityTarget[],
		node: ts.Node,
		container: ResponsibilityContainer,
	): void {
		if (container.kind === ResponsibilityContainerKind.Interface && ts.isMethodSignature(node)) {
			return;
		}
		const name = this.method_name(node);
		if (!name) {
			return;
		}
		targets.push(this.target('method', name, node));
	}

	/** Responsibilities: _TypeScript responsibility targets collection_. **/
	private append_class(node: ts.ClassDeclaration, targets: AstResponsibilityTarget[]): boolean {
		if (node.name === undefined) {
			return true;
		}
		const current: ResponsibilityContainer = {
			kind: ResponsibilityContainerKind.Class,
			line: this.source_file.getLineAndCharacterOfPosition(node.getStart(this.source_file)).line,
		};
		targets.push(this.target('class', node.name.text, node));
		node.members.forEach(member => this.visit(member, targets, current));
		return true;
	}

	/** Responsibilities: _TypeScript responsibility targets collection_. **/
	private append_interface(node: ts.InterfaceDeclaration, targets: AstResponsibilityTarget[]): boolean {
		const current: ResponsibilityContainer = {
			kind: ResponsibilityContainerKind.Interface,
			line: this.source_file.getLineAndCharacterOfPosition(node.getStart(this.source_file)).line,
		};
		targets.push(this.target('interface', node.name.text, node));
		node.members.forEach(member => this.visit(member, targets, current));
		return true;
	}

	/** Responsibilities: _TypeScript responsibility targets collection_. **/
	private append_function(node: ts.FunctionDeclaration, targets: AstResponsibilityTarget[]): boolean {
		if (node.name !== undefined) {
			targets.push(this.target('function', node.name.text, node));
		}
		return true;
	}

	/** Responsibilities: _TypeScript responsibility targets collection_. **/
	private append_variable(node: ts.VariableDeclaration, targets: AstResponsibilityTarget[]): boolean {
		if (node.initializer === undefined) {
			return true;
		}
		if (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) {
			targets.push(this.target('function', node.name.getText(this.source_file), node));
		}
		return true;
	}

	/** Responsibilities: _TypeScript declarations classification_. **/
	private append_declaration(node: ts.Node, targets: AstResponsibilityTarget[]): boolean {
		if (ts.isClassDeclaration(node)) {
			return this.append_class(node, targets);
		}
		if (ts.isInterfaceDeclaration(node)) {
			return this.append_interface(node, targets);
		}
		if (ts.isTypeAliasDeclaration(node)) {
			return true;
		}
		if (ts.isFunctionDeclaration(node)) {
			return this.append_function(node, targets);
		}
		if (ts.isVariableDeclaration(node)) {
			return this.append_variable(node, targets);
		}
		return false;
	}

	/** Responsibilities: _TypeScript responsibility targets collection_. **/
	private visit(
		node: ts.Node,
		targets: AstResponsibilityTarget[],
		container: ResponsibilityContainer,
	): void {
		if (container.kind !== ResponsibilityContainerKind.Root && this.method_kinds.has(node.kind)) {
			this.append_method(targets, node, container);
			return;
		}
		if (this.append_declaration(node, targets)) {
			return;
		}
		ts.forEachChild(node, child => this.visit(child, targets, this.root_container));
	}

	/** Responsibilities: _TypeScript responsibility targets collection_. **/
	public constructor(source_file: ts.SourceFile) {
		this.source_file = source_file;
	}

	/** Responsibilities: _TypeScript responsibility targets collection_. **/
	public collect(): AstResponsibilityTarget[] {
		return this.collect_nodes(this.source_file.statements);
	}

	/** Responsibilities: _TypeScript responsibility targets collection_. **/
	public collect_nodes(nodes: readonly ts.Node[]): AstResponsibilityTarget[] {
		const targets: AstResponsibilityTarget[] = [];
		nodes.forEach(node => this.visit(node, targets, this.root_container));
		return targets;
	}
}
