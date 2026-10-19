import ts from "typescript";
import type { TypeScriptInstanceStoreContract } from "src/model/protocols";
import { TypeScriptCallReturnAnalysis } from "src/parser/type_script_call_return_analysis";
import { TypeScriptReferenceBinding } from "src/parser/type_script_reference_binding";

/** Responsibilities: _assignment owner resolution_, _instance alias recording_. **/
export class TypeScriptInstanceAssignment {
	private readonly reference_binding: TypeScriptReferenceBinding;
	private readonly call_return_analysis: TypeScriptCallReturnAnalysis;

	/** Responsibilities: _assignment identity initialization_. **/
	public constructor() {
		this.reference_binding = new TypeScriptReferenceBinding();
		this.call_return_analysis = new TypeScriptCallReturnAnalysis();
	}

	/** Responsibilities: _assignment owner resolution_. **/
	public owner(node: ts.BinaryExpression, aliases: Map<string, string>, instances: TypeScriptInstanceStoreContract): string {
		const initializer = this.call_return_analysis.unwrapped_expression(node.right);
		if (ts.isNewExpression(initializer)) {
			return this.reference_binding.new_expression_owner(initializer, aliases);
		}
		if (!ts.isIdentifier(initializer)) {
			return "";
		}
		const resolved = instances.instance_owner(initializer.text, node);
		if (resolved.bound) {
			return resolved.value;
		}
		return "";
	}

	/** Responsibilities: _assignment identity storage_. **/
	public append(
		node: ts.BinaryExpression,
		aliases: Map<string, string>,
		instances: TypeScriptInstanceStoreContract,
	): void {
		if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return;
		}
		if (!ts.isIdentifier(node.left)) {
			return;
		}
		instances.add(node.left.text, this.owner(node, aliases, instances), node);
	}

}
