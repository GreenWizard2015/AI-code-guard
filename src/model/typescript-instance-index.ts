import ts from 'typescript';

import type { DestructuredAlias } from 'src/model/types';
import type { DestructuredInstanceOptions } from 'src/model/types';
import type { TypeScriptInstanceStore } from 'src/model/protocols';

/** Responsibilities: _indexing TypeScript instances scope_. **/
export class TypeScriptInstanceIndex implements TypeScriptInstanceStore {
	private readonly source_file: ts.SourceFile;
	private readonly instances = new Map<string, string>();

	/** Responsibilities: _classification node introduces instance_. **/
	private is_scope(node: ts.Node): boolean {
		const scope_checks = [
			ts.isFunctionDeclaration,
			ts.isMethodDeclaration,
			ts.isArrowFunction,
			ts.isFunctionExpression,
			ts.isConstructorDeclaration,
		];
		for (const check of scope_checks) {
			if (check(node)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _derivation stable scope key_. **/
	private scope_key(node: ts.Node): string {
		let current: ts.Node | undefined = node;
		while (current) {
			if (this.is_scope(current)) {
				return String(current.getStart(this.source_file));
			}
			current = current.parent;
		}
		return 'module';
	}

	/** Responsibilities: _resolution module-level instance owner_. **/
	private module_owner(name: string): string {
		const owner = this.instances.get(`module:${name}`);
		if (owner !== undefined) {
			return owner;
		}
		return '';
	}

	/** Responsibilities: _resolution instance owner traversal_. **/
	private find_scoped(name: string, node: ts.Node): string {
		let current: ts.Node | undefined = node;
		while (current) {
			if (this.is_scope(current)) {
				const owner = this.instances.get(`${current.getStart(this.source_file)}:${name}`);
				if (owner) {
					return owner;
				}
			}
			current = current.parent;
		}
		const scope = this.scope_key(node);
		const scoped = this.instances.get(`${scope}:${name}`);
		if (scoped !== undefined) {
			return scoped;
		}
		return this.module_owner(name);
	}

	/** Responsibilities: _initialization source file scope_. **/
	constructor(source_file: ts.SourceFile) {
		this.source_file = source_file;
	}

	/** Responsibilities: _instance owner more addition_. **/
	public add(name: string, owner: string, ...nodes: ts.Node[]): void {
		const node = nodes[0];
		if (node) {
			const key = `${this.scope_key(node)}:${name}`;
			this.instances.set(key, owner);
			return;
		}
		this.instances.set(name, owner);
	}

	/** Responsibilities: _instance owner supplied addition_. **/
	public add_all(
		entries: readonly DestructuredAlias[],
		node: ts.Node
	): void {
		for (const entry of entries) {
			this.add(entry.name, entry.owner, node);
		}
	}

	/** Responsibilities: _indexing instances introduced destructured_. **/
	public add_destructured(options: DestructuredInstanceOptions): void {
		const { node, initializer, current_owner, source_file, property_state } = options;
		if (!ts.isObjectBindingPattern(node.name)) {
			return;
		}
		this.add_all(
			property_state.destructured_aliases(node.name, source_file, initializer, current_owner),
			node
		);
	}

	/** Responsibilities: _resolution indexing owner name_. **/
	public instance_owner(name: string, node: ts.Node): string {
		const scoped = this.find_scoped(name, node);
		if (scoped) {
			return scoped;
		}
		const owner = this.instances.get(name);
		if (owner !== undefined) {
			return owner;
		}
		return '';
	}
}
