import { ERROR_CLASS_NAMES } from "src/constants";
import type { AstClassNode } from "src/model/ast/normalized_ast_types";
import type { ClassNodeContract } from "src/runtime_protocols";

/** Responsibilities: _class inheritance classification_, _class metric normalization_. **/
export class ClassNode implements ClassNodeContract {
	private readonly _value: AstClassNode;

	/** Responsibilities: _initialization normalization class data_. **/
	public constructor(value: AstClassNode) {
		this._value = value;
	}

	/** Responsibilities: _exposure class type contract_. **/
	public type_contract(): boolean {
		return this._value.classification.type_contract === true;
	}

	/** Responsibilities: _exposure class protocol_. **/
	public protocol(): boolean {
		return this._value.classification.protocol === true;
	}

	/** Responsibilities: _reporting class inherits exception_. **/
	public exception(): boolean {
		for (const base_name of this._value.structure.base_class_names) {
			const parts = base_name.split(".");
			const name = parts.at(-1);
			if (name !== undefined && ERROR_CLASS_NAMES.has(name)) {
				return true;
			}
		}
		return false;
	}
}
