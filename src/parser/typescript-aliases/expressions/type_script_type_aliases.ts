import type { TypeScriptTypeAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _local type alias collection_, _alias name resolution_. **/
export class TypeScriptTypeAliases implements TypeScriptTypeAliasesContract {
	private readonly _aliases: Map<string, string>;
	private readonly _keyword_type_kinds: Set<ts.SyntaxKind>;

	/** Responsibilities: _resolution type alias target_. **/
	private alias_target(statement: ts.Statement): string {
		if (!ts.isTypeAliasDeclaration(statement)) {
			return "";
		}
		if (ts.isTypeReferenceNode(statement.type) || this._keyword_type_kinds.has(statement.type.kind)) {
			return statement.type.getText();
		}
		if (ts.isArrayTypeNode(statement.type)) {
			return statement.type.getText();
		}
		if (!ts.isTypeOperatorNode(statement.type)) {
			return "";
		}
		if (statement.type.operator === ts.SyntaxKind.ReadonlyKeyword) {
			return statement.type.getText();
		}
		return "";
	}

	/** Responsibilities: _collection nested type aliases_. **/
	private append_alias_declarations(root: ts.Node, declarations: ts.TypeAliasDeclaration[]): void {
		const pending = [root];
		while (pending.length > 0) {
			const node = pending.pop();
			if (node === undefined) {
				continue;
			}
			if (ts.isTypeAliasDeclaration(node)) {
				declarations.push(node);
			}
			node.forEachChild((child) => {
				pending.push(child);
			});
		}
	}

	/** Responsibilities: _type alias insertion_. **/
	private append_alias(declaration: ts.TypeAliasDeclaration): void {
		const target = this.alias_target(declaration);
		if (target !== "") {
			this._aliases.set(declaration.name.text, target);
		}
	}

	/** Responsibilities: _type alias collection_. **/
	private collect_node(root: ts.Node): void {
		const declarations: ts.TypeAliasDeclaration[] = [];
		this.append_alias_declarations(root, declarations);
		for (let index = declarations.length - 1; index >= 0; index -= 1) {
			const declaration = declarations[index];
			if (declaration !== undefined) {
				this.append_alias(declaration);
			}
		}
	}

	/** Responsibilities: _collection aliases from source_. **/
	/** Responsibilities: _field initialization_. **/
	public constructor() {
		this._aliases = new Map<string, string>();
		this._keyword_type_kinds = new Set([
			ts.SyntaxKind.AnyKeyword,
			ts.SyntaxKind.UnknownKeyword,
			ts.SyntaxKind.ObjectKeyword,
		]);
	}
	/** Responsibilities: _public operation_. **/
	public collect(source_file: ts.SourceFile): void {
		this._aliases.clear();
		this.collect_node(source_file);
	}

	/** Responsibilities: _resolution aliases transitively_. **/
	public resolve(name: string): string {
		let current = name;
		const visited = new Set<string>();
		while (!visited.has(current)) {
			visited.add(current);
			const target = this._aliases.get(current);
			if (target === undefined) {
				return current;
			}
			current = target;
		}
		return current;
	}
}
