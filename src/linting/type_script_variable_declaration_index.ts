import type { TypeScriptVariableDeclarationsByName } from "src/linting/types";
import type { TypeScriptVariableDeclarationIndexContract } from "src/typescript_analysis_protocols";
import ts from "typescript";
/** Responsibilities: _source-file variable indexing_, _name-based declaration lookup_. **/
export class TypeScriptVariableDeclarationIndex implements TypeScriptVariableDeclarationIndexContract {
	private readonly _declarations_by_source: WeakMap<ts.SourceFile, TypeScriptVariableDeclarationsByName>;

	/** Responsibilities: _recursive variable declaration indexing_. **/
	private append_declarations(node: ts.Node, declarations: TypeScriptVariableDeclarationsByName): void {
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
			let named_declarations = declarations.get(node.name.text);
			if (named_declarations === undefined) {
				named_declarations = [];
				declarations.set(node.name.text, named_declarations);
			}
			named_declarations.push(node);
		}
		node.forEachChild((child) => this.append_declarations(child, declarations));
	}

	/** Responsibilities: _source declaration index initialization_. **/
	public constructor() {
		this._declarations_by_source = new WeakMap();
	}

	/** Responsibilities: _visible-name declaration candidates_. **/
	public declarations(source_file: ts.SourceFile, name: string): readonly ts.VariableDeclaration[] {
		let declarations = this._declarations_by_source.get(source_file);
		if (declarations === undefined) {
			declarations = new Map();
			this.append_declarations(source_file, declarations);
			this._declarations_by_source.set(source_file, declarations);
		}
		const matching_declarations = declarations.get(name);
		if (matching_declarations === undefined) {
			return [];
		}
		return matching_declarations;
	}

	/** Responsibilities: _source declaration name classification_. **/
	public declarations_present(source_file: ts.SourceFile, name: string): boolean {
		return this.declarations(source_file, name).length > 0;
	}
}
