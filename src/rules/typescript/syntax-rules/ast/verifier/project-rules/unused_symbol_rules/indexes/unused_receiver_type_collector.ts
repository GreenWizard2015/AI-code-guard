import type { UnusedReceiverTypeIndexContract } from "src/contracts/protocols/lint_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _receiver type collection_, _receiver type lookup_. **/
export class UnusedReceiverTypeCollector implements UnusedReceiverTypeIndexContract {
	private readonly _types: Map<string, string>;

	/** Responsibilities: _receiver type reference registration_. **/
	private append_type_reference(receiver_name: string, type: ts.TypeNode): void {
		if (!ts.isTypeReferenceNode(type)) {
			return;
		}
		if (this._types.has(receiver_name)) {
			return;
		}
		if (ts.isIdentifier(type.typeName)) {
			this._types.set(receiver_name, type.typeName.text);
		}
	}

	/** Responsibilities: _declared receiver type registration_. **/
	private append_declared_type(node: ts.Node): void {
		if (!ts.isVariableDeclaration(node) && !ts.isParameter(node)) {
			return;
		}
		if (ts.isIdentifier(node.name) && node.type !== undefined) {
			this.append_type_reference(node.name.text, node.type);
		}
	}

	/** Responsibilities: _receiver node indexing_, _child scheduling_. **/
	private append_node(current: ts.Node, pending_nodes: ts.Node[]): void {
		if (ts.isVariableDeclaration(current) || ts.isParameter(current)) {
			this.append_declared_type(current);
		}
		const children: ts.Node[] = [];
		current.forEachChild((child) => {
			children.push(child);
		});
		for (let index = children.length - 1; index >= 0; index -= 1) {
			const child = children[index];
			if (child !== undefined) {
				pending_nodes.push(child);
			}
		}
	}

	/** Responsibilities: _receiver collector initialization_. **/
	public constructor() {
		this._types = new Map<string, string>();
	}

	/** Responsibilities: _receiver type collection_. **/
	public collect(source_file: ts.SourceFile): void {
		const pending_nodes: ts.Node[] = [source_file];
		while (pending_nodes.length > 0) {
			const node = pending_nodes.pop();
			if (node === undefined) {
				continue;
			}
			this.append_node(node, pending_nodes);
		}
	}

	/** Responsibilities: _receiver type lookup_. **/
	public type(receiver_name: string): string {
		const receiver_type = this._types.get(receiver_name);
		if (receiver_type === undefined) {
			return "";
		}
		return receiver_type;
	}
}
