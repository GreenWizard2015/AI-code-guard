import ts from "typescript";

/** Responsibilities: _string key declarations_, _transitive string aliases_. **/
export class TypeScriptStringKeyNameCollection {
	private readonly _collected_names: Set<string>;
	public readonly _key_names: ReadonlySet<string>;

	/** Responsibilities: _string typed binding name_. **/
	private string_named_binding(name: ts.Node, type: ts.TypeNode): string {
		if (!ts.isIdentifier(name) || type.kind !== ts.SyntaxKind.StringKeyword) {
			return "";
		}
		return name.text;
	}

	/** Responsibilities: _string declaration-name storage_. **/
	private append_typed_name(name: ts.Node, type: ts.TypeNode): void {
		const key_name = this.string_named_binding(name, type);
		if (key_name.length > 0) {
			this._collected_names.add(key_name);
		}
	}

	/** Responsibilities: _string alias declaration_. **/
	private append_alias_declaration(declaration: ts.VariableDeclaration): boolean {
		if (!ts.isIdentifier(declaration.name) || declaration.initializer === undefined) {
			return false;
		}
		if (!ts.isIdentifier(declaration.initializer)) {
			return false;
		}
		const source_name = declaration.initializer.text;
		const alias_name = declaration.name.text;
		if (!this._collected_names.has(source_name) || this._collected_names.has(alias_name)) {
			return false;
		}
		this._collected_names.add(alias_name);
		return true;
	}

	/** Responsibilities: _string key collection initialization_. **/
	public constructor() {
		const names = new Set<string>();
		this._collected_names = names;
		this._key_names = names;
	}

	/** Responsibilities: _string key declaration traversal_. **/
	public append_declarations(node: ts.Node): void {
		if (ts.isParameter(node) && node.type !== undefined) {
			this.append_typed_name(node.name, node.type);
		} else if (ts.isVariableDeclaration(node) && node.type !== undefined) {
			this.append_typed_name(node.name, node.type);
		} else if ((ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) && node.type !== undefined) {
			this.append_typed_name(node.name, node.type);
		}
		ts.forEachChild(node, (child) => this.append_declarations(child));
	}

	/** Responsibilities: _transitive string aliases_. **/
	public append_aliases(source_file: ts.SourceFile): void {
		let changed = true;
		while (changed) {
			changed = false;
			const pending: ts.Node[] = [source_file];
			while (pending.length > 0) {
				const node = pending.pop();
				if (node === undefined) {
					continue;
				}
				if (ts.isVariableDeclaration(node) && this.append_alias_declaration(node)) {
					changed = true;
				}
				node.forEachChild((child) => {
					pending.push(child);
				});
			}
		}
	}
}
