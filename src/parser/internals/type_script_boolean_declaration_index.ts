import ts from "typescript";
import type { TypeScriptBooleanDeclarationIndexContract } from "src/protocols";

/** Responsibilities: _boolean property names_, _boolean callable names_. **/
export class TypeScriptBooleanDeclarationIndex implements TypeScriptBooleanDeclarationIndexContract {
	private readonly property_names: Set<string>;
	private readonly callable_names: Set<string>;
	public readonly boolean_properties: ReadonlySet<string>;
	public readonly boolean_callables: ReadonlySet<string>;

	/** Responsibilities: _boolean declaration inventory_. **/
	private append_declaration(node: ts.Node, source_file: ts.SourceFile): void {
		if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) {
			if (node.type?.kind === ts.SyntaxKind.BooleanKeyword) {
				this.property_names.add(node.name.getText(source_file));
			}
		}
		if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
			if (node.type?.kind === ts.SyntaxKind.BooleanKeyword && node.name !== undefined) {
				this.callable_names.add(node.name.getText(source_file));
			}
		}
		ts.forEachChild(node, (child) => this.append_declaration(child, source_file));
	}

	/** Responsibilities: _boolean declaration index construction_. **/
	public constructor() {
		this.property_names = new Set<string>();
		this.callable_names = new Set<string>();
		this.boolean_properties = this.property_names;
		this.boolean_callables = this.callable_names;
	}

	/** Responsibilities: _boolean declaration indexing_. **/
	public append(source_file: ts.SourceFile): void {
		this.append_declaration(source_file, source_file);
	}
}
