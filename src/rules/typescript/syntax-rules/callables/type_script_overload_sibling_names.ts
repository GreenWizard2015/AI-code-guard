import type {
	TypeScriptOverloadSiblingCounts,
	TypeScriptOverloadSiblingNamesContract,
} from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _overload declaration indexing_, _sibling declaration counts_. **/
export class TypeScriptOverloadSiblingNames implements TypeScriptOverloadSiblingNamesContract {
	private readonly _function_declarations: Map<string, number>;
	private readonly _implemented_methods: Set<string>;
	private readonly _interface_methods: Map<string, number>;

	/** Responsibilities: _overload declaration count increment_. **/
	private increment(counts: Map<string, number>, name: string): void {
		const count = counts.get(name);
		if (count === undefined) {
			counts.set(name, 1);
			return;
		}
		counts.set(name, count + 1);
	}

	/** Responsibilities: _sibling overload index initialization_. **/
	public constructor() {
		this._function_declarations = new Map<string, number>();
		this._implemented_methods = new Set<string>();
		this._interface_methods = new Map<string, number>();
	}

	/** Responsibilities: _sibling overload declaration indexing_. **/
	public append(node: ts.Node): void {
		if (ts.isFunctionDeclaration(node) && node.name !== undefined) {
			this.increment(this._function_declarations, node.name.getText());
			return;
		}
		if (ts.isMethodDeclaration(node) && node.body !== undefined && node.name !== undefined) {
			this._implemented_methods.add(node.name.getText());
			return;
		}
		if (ts.isMethodSignature(node) && node.name !== undefined) {
			this.increment(this._interface_methods, node.name.getText());
		}
	}

	/** Responsibilities: _function overload count lookup_. **/
	public counts(name: string): TypeScriptOverloadSiblingCounts {
		const declared_function_count = this._function_declarations.get(name);
		let function_count = 0;
		if (declared_function_count !== undefined) {
			function_count = declared_function_count;
		}
		const declared_interface_count = this._interface_methods.get(name);
		let interface_count = 0;
		if (declared_interface_count !== undefined) {
			interface_count = declared_interface_count;
		}
		return {
			function_declarations: function_count,
			implemented_methods: Number(this._implemented_methods.has(name)),
			interface_methods: interface_count,
		};
	}
}
