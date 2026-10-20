import ts from "typescript";
import type { SourceFileCallableCache, SourceFileCallableMap } from "src/source_types";

/** Responsibilities: _callable declaration indexing_, _array result lookup_. **/
export class TypeScriptArrayCallableDeclarations {
	private readonly cache: SourceFileCallableCache;

	/** Responsibilities: _named callable storage_. **/
	private append_named(
		declarations_by_name: Map<string, ts.FunctionLikeDeclaration[]>,
		name: string,
		declaration: ts.FunctionLikeDeclaration,
	): void {
		let declarations = declarations_by_name.get(name);
		if (declarations === undefined) {
			declarations = [];
			declarations_by_name.set(name, declarations);
		}
		declarations.push(declaration);
	}

	/** Responsibilities: _function declaration indexing_. **/
	private append_function(node: ts.Node, declarations_by_name: Map<string, ts.FunctionLikeDeclaration[]>): void {
		if (!ts.isFunctionDeclaration(node)) {
			return;
		}
		if (node.name !== undefined) {
			this.append_named(declarations_by_name, node.name.text, node);
		}
	}

	/** Responsibilities: _method declaration indexing_. **/
	private append_methods(node: ts.Node, declarations_by_name: Map<string, ts.FunctionLikeDeclaration[]>): void {
		if (!ts.isClassLike(node)) {
			return;
		}
		for (const member of node.members) {
			if (!ts.isMethodDeclaration(member)) {
				continue;
			}
			if (member.name !== undefined) {
				this.append_named(declarations_by_name, member.name.getText(), member);
			}
		}
	}

	/** Responsibilities: _callable variable indexing_. **/
	private append_variable(node: ts.Node, declarations_by_name: Map<string, ts.FunctionLikeDeclaration[]>): void {
		if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name)) {
			return;
		}
		const initializer = node.initializer;
		if (initializer === undefined) {
			return;
		}
		if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) {
			this.append_named(declarations_by_name, node.name.text, initializer);
		}
	}

	/** Responsibilities: _nested callable declaration indexing_. **/
	private append_index(node: ts.Node, declarations_by_name: Map<string, ts.FunctionLikeDeclaration[]>): void {
		this.append_function(node, declarations_by_name);
		this.append_methods(node, declarations_by_name);
		this.append_variable(node, declarations_by_name);
		node.forEachChild((child) => this.append_index(child, declarations_by_name));
	}

	/** Responsibilities: _callable declaration index creation_. **/
	private index(source_file: ts.SourceFile): ReadonlyMap<string, readonly ts.FunctionLikeDeclaration[]> {
		const declarations_by_name = new Map<string, ts.FunctionLikeDeclaration[]>();
		this.append_index(source_file, declarations_by_name);
		return declarations_by_name;
	}

	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.cache = new WeakMap<ts.SourceFile, SourceFileCallableMap>();
	}

	/** Responsibilities: _callable declaration collection_. **/
	public collect_index(source_file: ts.SourceFile): ReadonlyMap<string, readonly ts.FunctionLikeDeclaration[]> {
		let declarations_by_name = this.cache.get(source_file);
		if (declarations_by_name === undefined) {
			declarations_by_name = this.index(source_file);
			this.cache.set(source_file, declarations_by_name);
		}
		return declarations_by_name;
	}

	/** Responsibilities: _named callable declaration collection_. **/
	public collect(source_file: ts.SourceFile, name: string): readonly ts.FunctionLikeDeclaration[] {
		const declarations = this.collect_index(source_file).get(name);
		if (declarations === undefined) {
			return [];
		}
		return declarations;
	}
}
