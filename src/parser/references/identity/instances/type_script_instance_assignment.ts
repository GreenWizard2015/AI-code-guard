import type { TypeScriptInstanceStoreContract } from "src/model/protocols";
import { TypeScriptCallReturnAnalysis } from "src/parser/type_script_call_return_analysis";
import { TypeScriptReferenceBinding } from "src/parser/type_script_reference_binding";
import ts from "typescript";

/** Responsibilities: _assignment owner resolution_, _instance alias recording_. **/
export class TypeScriptInstanceAssignment {
	private readonly _instances: TypeScriptInstanceStoreContract;
	private readonly _reference_binding: TypeScriptReferenceBinding;
	private readonly _call_return_analysis: TypeScriptCallReturnAnalysis;

	/** Responsibilities: _assignment identity initialization_. **/
	public constructor(aliases: Map<string, string>, instances: TypeScriptInstanceStoreContract) {
		this._instances = instances;
		this._reference_binding = new TypeScriptReferenceBinding(aliases, instances);
		this._call_return_analysis = new TypeScriptCallReturnAnalysis();
	}

	/** Responsibilities: _assignment owner resolution_. **/
	public owner(node: ts.BinaryExpression): string {
		const initializer = this._call_return_analysis.unwrapped_expression(node.right);
		if (ts.isNewExpression(initializer)) {
			return this._reference_binding.new_expression_owner(initializer);
		}
		if (!ts.isIdentifier(initializer)) {
			return "";
		}
		const resolved = this._instances.instance_owner(initializer.text, node);
		if (resolved.bound) {
			return resolved.value;
		}
		return "";
	}

	/** Responsibilities: _assignment identity storage_. **/
	public append(node: ts.BinaryExpression): void {
		if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return;
		}
		if (!ts.isIdentifier(node.left)) {
			return;
		}
		this._instances.add(node.left.text, this.owner(node), node);
	}
}
