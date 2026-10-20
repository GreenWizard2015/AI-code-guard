import type { ClassNodeInput } from "src/model/types/types";
import type { ClassNodeContract } from "src/runtime_protocols";
import { ERROR_CLASS_NAMES, ERROR_CLASS_SUFFIXES } from "src/constants";

/** Responsibilities: _class inheritance classification_, _class metric normalization_. **/
export class ClassNode implements ClassNodeContract {
	private readonly value: ClassNodeInput;

	/** Responsibilities: _classification any base class_. **/
	private has_exception_base(): boolean {
		for (const base_name of this.base_names()) {
			const parts = base_name.split(".");
			const name = parts[parts.length - 1];
			if (this.is_exception_base(name)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _classification base class name_. **/
	private is_exception_base(name: string): boolean {
		if (ERROR_CLASS_NAMES.has(name)) {
			return true;
		}
		return ERROR_CLASS_SUFFIXES.some((suffix) => name.endsWith(suffix));
	}

	/** Responsibilities: _combination direct inherited class_. **/
	private base_names(): readonly string[] {
		if (this.value.base_class_names.length > 0) {
			return this.value.base_class_names;
		}
		if (this.value.base_class_name.length > 0) {
			return [this.value.base_class_name];
		}
		return [];
	}

	/** Responsibilities: _initialization normalization class data_. **/
	public constructor(value: ClassNodeInput) {
		this.value = value;
	}

	/** Responsibilities: _exposure class type contract_. **/
	public type_contract(): boolean {
		return this.value.type_contract === true;
	}

	/** Responsibilities: _exposure class protocol_. **/
	public protocol(): boolean {
		return this.value.protocol === true;
	}

	/** Responsibilities: _reporting class inherits exception_. **/
	public exception(): boolean {
		for (const suffix of ERROR_CLASS_SUFFIXES) {
			if (this.value.name.endsWith(suffix)) {
				return true;
			}
		}
		return this.has_exception_base();
	}
}
