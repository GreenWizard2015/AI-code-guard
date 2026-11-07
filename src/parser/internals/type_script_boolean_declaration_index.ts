import type { TypeScriptBooleanDeclarationIndexContract } from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _boolean property names_, _boolean callable names_. **/
export class TypeScriptBooleanDeclarationIndex implements TypeScriptBooleanDeclarationIndexContract {
	private readonly _property_names: Set<string>;
	private readonly _callable_names: Set<string>;

	/** Responsibilities: _boolean declaration inventory_. **/
	private append_declaration(node: ts.Node, source_file: ts.SourceFile): void {
		if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) {
			if (node.type?.kind === ts.SyntaxKind.BooleanKeyword) {
				this._property_names.add(node.name.getText(source_file));
			}
		}
		if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
			if (node.type?.kind === ts.SyntaxKind.BooleanKeyword && node.name !== undefined) {
				this._callable_names.add(node.name.getText(source_file));
			}
		}
		ts.forEachChild(node, (child) => this.append_declaration(child, source_file));
	}

	/** Responsibilities: _boolean declaration index construction_. **/
	public constructor() {
		this._property_names = new Set<string>();
		this._callable_names = new Set<string>();
	}

	/** Responsibilities: _boolean property names_. **/
	public boolean_properties(): ReadonlySet<string> {
		return this._property_names;
	}

	/** Responsibilities: _boolean callable names_. **/
	public boolean_callables(): ReadonlySet<string> {
		return this._callable_names;
	}

	/** Responsibilities: _boolean declaration indexing_. **/
	public append(source_file: ts.SourceFile): void {
		this.append_declaration(source_file, source_file);
	}
}
