import type { TypeScriptBooleanDeclarationIndexContract } from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _boolean property names_, _boolean callable names_. **/
export class TypeScriptBooleanDeclarationIndex implements TypeScriptBooleanDeclarationIndexContract {
	private readonly _property_names: Set<string>;
	private readonly _callable_names: Set<string>;

	/** Responsibilities: _boolean property name collection_. **/
	private append_property(property_node: ts.Node): void {
		if (!ts.isPropertyDeclaration(property_node) && !ts.isPropertySignature(property_node)) {
			return;
		}
		const property_type = property_node.type;
		if (property_type !== undefined && property_type.kind === ts.SyntaxKind.BooleanKeyword) {
			this._property_names.add(property_node.name.getText(property_node.getSourceFile()));
		}
	}

	/** Responsibilities: _boolean callable name collection_. **/
	private append_callable(callable_node: ts.Node): void {
		if (!ts.isFunctionDeclaration(callable_node) && !ts.isMethodDeclaration(callable_node)) {
			return;
		}
		const return_type = callable_node.type;
		const name = callable_node.name;
		if (return_type !== undefined && name !== undefined && return_type.kind === ts.SyntaxKind.BooleanKeyword) {
			this._callable_names.add(name.getText(callable_node.getSourceFile()));
		}
	}

	/** Responsibilities: _boolean declaration inventory_. **/
	private append_declaration(declaration_node: ts.Node): void {
		this.append_property(declaration_node);
		this.append_callable(declaration_node);
		ts.forEachChild(declaration_node, (child) => this.append_declaration(child));
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
		for (const statement of source_file.statements) {
			this.append_declaration(statement);
		}
	}
}
