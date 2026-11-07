import type { TypeScriptInstanceStoreContract } from "src/model/protocols";
import { TypeScriptReferenceType } from "src/parser/analysis/type_script_reference_type";
import type { TypeScriptReferenceBindingContract } from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _TypeScript reference resolution_, _instance owner resolution_. **/
export class TypeScriptReferenceBinding implements TypeScriptReferenceBindingContract {
	private readonly _reference_type: typeof TypeScriptReferenceType;
	private readonly _aliases: Map<string, string>;
	private readonly _instances: TypeScriptInstanceStoreContract;

	/** Responsibilities: _resolution class name construction_. **/
	private new_expression_name(expression: ts.NewExpression): string {
		if (!ts.isIdentifier(expression.expression)) {
			return "";
		}
		return expression.expression.text;
	}

	/** Responsibilities: _resolution name through configuration_. **/
	private aliased_name(name: string, aliases: Map<string, string>): string {
		const alias = aliases.get(name);
		if (alias === undefined) {
			return name;
		}
		return alias;
	}

	/** Responsibilities: _reference aliases_, _instance ownership_. **/
	public constructor(aliases: Map<string, string>, instances: TypeScriptInstanceStoreContract) {
		this._reference_type = TypeScriptReferenceType;
		this._aliases = aliases;
		this._instances = instances;
	}

	/** Responsibilities: _constructor owner identity_. **/
	public new_expression_owner(expression: ts.NewExpression): string {
		const name = this.new_expression_name(expression);
		if (name.length === 0) {
			return "";
		}
		return this.aliased_name(name, this._aliases);
	}

	/** Responsibilities: _resolution referenced expression name_. **/
	public resolved_reference_name(type: ts.TypeNode): string {
		const reference = new this._reference_type(type);
		const name = reference.resolved_name(this._aliases);
		if (name) {
			return name;
		}
		return "";
	}

	/** Responsibilities: _resolution parameter's declared owner_. **/
	public parameter_owner(node: ts.ParameterDeclaration): string {
		const initializer = node.initializer;
		if (initializer !== undefined && ts.isNewExpression(initializer)) {
			return this.new_expression_owner(initializer);
		}
		if (node.type === undefined) {
			return "";
		}
		return this.resolved_reference_name(node.type);
	}

	/** Responsibilities: _resolution instance owner represented_. **/
	public new_instance(node: ts.VariableDeclaration, initializer: ts.Expression): boolean {
		if (!ts.isNewExpression(initializer)) {
			return false;
		}
		const owner = this.new_expression_owner(initializer);
		if (!owner) {
			return false;
		}
		this._instances.add(node.name.getText(node.getSourceFile()), owner, node);
		return true;
	}
}
