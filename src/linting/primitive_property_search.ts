import { TypeScriptTypeNode } from "src/model/type_script_type_node";
import ts from "typescript";

/** Responsibilities: _primitive property lookup_, _property type classification_. **/
export class PrimitivePropertySearch {
	private readonly _source_file: ts.SourceFile;
	private readonly _property_name: string;

	/** Responsibilities: _property lookup initialization_. **/
	public constructor(source_file: ts.SourceFile, property_name: string) {
		this._source_file = source_file;
		this._property_name = property_name;
	}

	/** Responsibilities: _primitive property candidate_. **/
	public matches(node: ts.Node): boolean {
		if (!ts.isPropertySignature(node) && !ts.isPropertyDeclaration(node)) {
			return false;
		}
		if (!ts.isIdentifier(node.name)) {
			return false;
		}
		if (node.name.text !== this._property_name) {
			return false;
		}
		if (node.type === undefined) {
			return false;
		}
		const type_node = new TypeScriptTypeNode(node.type);
		return type_node.primitive();
	}

	/** Responsibilities: _primitive property existence_. **/
	public find(): boolean {
		let found = false;
		const visit = (node: ts.Node): void => {
			if (found) {
				return;
			}
			if (this.matches(node)) {
				found = true;
				return;
			}
			ts.forEachChild(node, visit);
		};
		visit(this._source_file);
		return found;
	}
}
