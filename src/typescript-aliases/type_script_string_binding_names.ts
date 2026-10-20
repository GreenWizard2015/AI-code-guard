import ts from "typescript";
import type { SourceFileStringSetCache } from "src/source_types";

/** Responsibilities: _string binding-name analysis_, _dynamic key classification_. **/
export class TypeScriptStringBindingNames {
	private readonly key_cache: SourceFileStringSetCache;

	/** Responsibilities: _string binding name_. **/
	private string_binding_name(node: ts.Node): string {
		if (ts.isParameter(node) || ts.isVariableDeclaration(node)) {
			if (node.type === undefined) {
				return "";
			}
			return this.string_named_binding(node.name, node.type);
		}
		if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) {
			if (node.type === undefined) {
				return "";
			}
			return this.string_named_binding(node.name, node.type);
		}
		return "";
	}

	/** Responsibilities: _string typed declaration_. **/
	private string_named_binding(name: ts.Node, type: ts.TypeNode): string {
		if (!ts.isIdentifier(name)) {
			return "";
		}
		if (type.kind !== ts.SyntaxKind.StringKeyword) {
			return "";
		}
		return name.text;
	}

	/** Responsibilities: _string key declarations_. **/
	private append_key_names(node: ts.Node, names: Set<string>): void {
		const name = this.string_binding_name(node);
		if (name.length > 0) {
			names.add(name);
		}
		ts.forEachChild(node, (child) => this.append_key_names(child, names));
	}

	/** Responsibilities: _string alias addition_. **/
	private append_alias(node: ts.Node, names: Set<string>): boolean {
		if (!ts.isVariableDeclaration(node)) {
			return false;
		}
		if (!ts.isIdentifier(node.name) || node.initializer === undefined) {
			return false;
		}
		if (!ts.isIdentifier(node.initializer)) {
			return false;
		}
		if (!names.has(node.initializer.text) || names.has(node.name.text)) {
			return false;
		}
		names.add(node.name.text);
		return true;
	}

	/** Responsibilities: _transitive string aliases_. **/
	private append_aliases(node: ts.Node, names: Set<string>): boolean {
		let changed = this.append_alias(node, names);
		ts.forEachChild(node, (child) => {
			if (this.append_aliases(child, names)) {
				changed = true;
			}
		});
		return changed;
	}

	/** Responsibilities: _source string key index_. **/
	private create_key_names(source_file: ts.SourceFile): ReadonlySet<string> {
		const names = new Set<string>();
		this.append_key_names(source_file, names);
		let changed = true;
		while (changed) {
			changed = this.append_aliases(source_file, names);
		}
		return names;
	}

	/** Responsibilities: _string key cache initialization_. **/
	public constructor() {
		this.key_cache = new WeakMap<ts.SourceFile, ReadonlySet<string>>();
	}

	/** Responsibilities: _string key cache_. **/
	public string_key_names(source_file: ts.SourceFile): ReadonlySet<string> {
		const cached_names = this.key_cache.get(source_file);
		if (cached_names !== undefined) {
			return cached_names;
		}
		const names = this.create_key_names(source_file);
		this.key_cache.set(source_file, names);
		return names;
	}

	/** Responsibilities: _dynamic property key_. **/
	public dynamic_key(node: ts.Node, source_file: ts.SourceFile): boolean {
		if (!ts.isElementAccessExpression(node)) {
			return false;
		}
		if (ts.isCallExpression(node.expression) || ts.isNewExpression(node.expression)) {
			return false;
		}
		const key = node.argumentExpression;
		if (!ts.isIdentifier(key)) {
			return false;
		}
		return this.string_key_names(source_file).has(key.text);
	}
}
