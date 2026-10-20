import ts from "typescript";
import type { TypeScriptVariableDeclarationIndexContract } from "src/typescript_analysis_protocols";
import type { TypeScriptVariableDeclarationsByName } from "src/linting/types";

/** Responsibilities: _source-file variable declarations_, _name-based declaration lookup_. **/
export class TypeScriptVariableDeclarationIndex implements TypeScriptVariableDeclarationIndexContract {
	private readonly declarations_by_source: WeakMap<ts.SourceFile, TypeScriptVariableDeclarationsByName>;

	/** Responsibilities: _variable declaration inventory_. **/
	private append_declaration(node: ts.Node, declarations: Map<string, ts.VariableDeclaration[]>): void {
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
			let named_declarations = declarations.get(node.name.text);
			if (named_declarations === undefined) {
				named_declarations = [];
				declarations.set(node.name.text, named_declarations);
			}
			named_declarations.push(node);
		}
		node.forEachChild((child) => this.append_declaration(child, declarations));
	}

	/** Responsibilities: _one-pass source declaration indexing_. **/
	private build_index(source_file: ts.SourceFile): TypeScriptVariableDeclarationsByName {
		const declarations = new Map<string, ts.VariableDeclaration[]>();
		this.append_declaration(source_file, declarations);
		return declarations;
	}

	/** Responsibilities: _source declaration map access_. **/
	private declaration_map(source_file: ts.SourceFile): TypeScriptVariableDeclarationsByName {
		let declarations = this.declarations_by_source.get(source_file);
		if (declarations === undefined) {
			declarations = this.build_index(source_file);
			this.declarations_by_source.set(source_file, declarations);
		}
		return declarations;
	}

	/** Responsibilities: _source declaration index initialization_. **/
	public constructor() {
		this.declarations_by_source = new WeakMap();
	}

	/** Responsibilities: _visible-name declaration candidates_. **/
	public declarations(source_file: ts.SourceFile, name: string): readonly ts.VariableDeclaration[] {
		const declaration_map = this.declaration_map(source_file);
		const declarations = declaration_map.get(name);
		if (declarations === undefined) {
			return [];
		}
		return declarations;
	}

	/** Responsibilities: _source declaration name classification_. **/
	public declarations_present(source_file: ts.SourceFile, name: string): boolean {
		return this.declaration_map(source_file).has(name);
	}
}
