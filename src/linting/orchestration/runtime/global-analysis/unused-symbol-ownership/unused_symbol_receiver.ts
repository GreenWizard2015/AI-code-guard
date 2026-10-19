import ts from "typescript";
import type { UnusedReceiverTypeCache } from "src/core/types";

/** Responsibilities: _receiver type indexing_, _property receiver resolution_. **/
export class UnusedSymbolReceiver {
	private readonly cache: UnusedReceiverTypeCache;

	/** Responsibilities: _variable receiver type_. **/
	private variable_type(node: ts.VariableDeclaration, types: Map<string, string>): void {
		if (!ts.isIdentifier(node.name)) {
			return;
		}
		if (node.type === undefined) {
			return;
		}
		if (types.has(node.name.text)) {
			return;
		}
		if (!ts.isTypeReferenceNode(node.type)) {
			return;
		}
		if (ts.isIdentifier(node.type.typeName)) {
			types.set(node.name.text, node.type.typeName.text);
		}
	}

	/** Responsibilities: _parameter receiver type_. **/
	private parameter_type(node: ts.ParameterDeclaration, types: Map<string, string>): void {
		if (!ts.isIdentifier(node.name)) {
			return;
		}
		if (node.type === undefined) {
			return;
		}
		if (types.has(node.name.text)) {
			return;
		}
		if (!ts.isTypeReferenceNode(node.type)) {
			return;
		}
		if (ts.isIdentifier(node.type.typeName)) {
			types.set(node.name.text, node.type.typeName.text);
		}
	}

	/** Responsibilities: _receiver type traversal_. **/
	private visit(node: ts.Node, types: Map<string, string>): void {
		if (ts.isVariableDeclaration(node)) {
			this.variable_type(node, types);
		}
		if (ts.isParameter(node)) {
			this.parameter_type(node, types);
		}
		node.forEachChild((child) => this.visit(child, types));
	}

	/** Responsibilities: _receiver type index_. **/
	private type_index(source_file: ts.SourceFile): Map<string, string> {
		const cached = this.cache.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const types = new Map<string, string>();
		this.visit(source_file, types);
		this.cache.set(source_file, types);
		return types;
	}

	/** Responsibilities: _receiver resolver initialization_. **/
	public constructor() {
		this.cache = new WeakMap<ts.SourceFile, Map<string, string>>();
	}

	/** Responsibilities: _receiver type access_. **/
	public type(source_file: ts.SourceFile, receiver: ts.Expression): string {
		if (!ts.isIdentifier(receiver)) {
			return "";
		}
		const cached = this.type_index(source_file).get(receiver.text);
		if (cached === undefined) {
			return "";
		}
		return cached;
	}

	/** Responsibilities: _typed receiver presence_. **/
	public known(source_file: ts.SourceFile, receiver: ts.Expression): boolean {
		return this.type(source_file, receiver).length > 0;
	}
}
