import type { TypeScriptOverloadSiblingNamesContract } from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _overload declaration indexing_, _sibling declaration counts_. **/
export class TypeScriptOverloadSiblingNames implements TypeScriptOverloadSiblingNamesContract {
	private readonly function_declarations: Map<string, number>;
	private readonly implemented_methods: Set<string>;
	private readonly interface_methods: Map<string, number>;

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
		this.function_declarations = new Map<string, number>();
		this.implemented_methods = new Set<string>();
		this.interface_methods = new Map<string, number>();
	}

	/** Responsibilities: _sibling overload declaration indexing_. **/
	public append(node: ts.Node): void {
		if (ts.isFunctionDeclaration(node) && node.name !== undefined) {
			this.increment(this.function_declarations, node.name.getText());
			return;
		}
		if (ts.isMethodDeclaration(node) && node.body !== undefined && node.name !== undefined) {
			this.implemented_methods.add(node.name.getText());
			return;
		}
		if (ts.isMethodSignature(node) && node.name !== undefined) {
			this.increment(this.interface_methods, node.name.getText());
		}
	}

	/** Responsibilities: _function overload count lookup_. **/
	public function_declaration_count(name: string): number {
		const count = this.function_declarations.get(name);
		if (count === undefined) {
			return 0;
		}
		return count;
	}

	/** Responsibilities: _implemented method lookup_. **/
	public implemented_method_count(name: string): number {
		return Number(this.implemented_methods.has(name));
	}

	/** Responsibilities: _interface method count lookup_. **/
	public interface_method_count(name: string): number {
		const count = this.interface_methods.get(name);
		if (count === undefined) {
			return 0;
		}
		return count;
	}
}
