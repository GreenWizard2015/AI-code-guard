import type { SharedParameterLanguage, SharedParameterToolingCategory } from "src/metrics/types";
import { TYPESCRIPT_LANGUAGE } from "src/constants";
import {
	NAMESPACE_PARAMETER_CATEGORY,
	READONLY_BUILTIN_TYPES,
	UNDEFINED_TYPE_NAME,
} from "src/metrics/constants";

/** Responsibilities: _tooling category classification_, _language-specific type detection_. **/
export class SharedParameterTooling {
	private readonly builtin_types: Set<string>;
	private readonly python_builtin_types: Set<string>;

	/** Responsibilities: _tooling type category_. **/
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.builtin_types = new Set([
			"Array",
			"BigInt",
			"Boolean",
			"Date",
			"Error",
			"Map",
			"Number",
			"Object",
			"Promise",
			"Record",
			...READONLY_BUILTIN_TYPES,
			"Set",
			"String",
			"Uint8Array",
			"unknown",
			"boolean",
			"never",
			"number",
			"object",
			"string",
			"symbol",
			UNDEFINED_TYPE_NAME,
			"void",
		]);
		this.python_builtin_types = new Set(["Path"]);
	}
	/** Responsibilities: _public operation_. **/
	public category(type: string, language: SharedParameterLanguage): SharedParameterToolingCategory {
		if (this.builtin_types.has(type)) {
			return "builtin";
		}
		if (language === "python") {
			if (this.python_builtin_types.has(type)) {
				return "builtin";
			}
		}
		if (language === TYPESCRIPT_LANGUAGE) {
			if (type.startsWith("Json")) {
				return NAMESPACE_PARAMETER_CATEGORY;
			}
		}
		if (type.startsWith("ast.") || type.startsWith("ts.")) {
			return NAMESPACE_PARAMETER_CATEGORY;
		}
		return "custom";
	}

	/** Responsibilities: _tooling type classification_. **/
	public tooling_type(type: string, language: SharedParameterLanguage): boolean {
		if (this.category(type, language) !== "custom") {
			return true;
		}
		return type.length === 1 && type === type.toUpperCase();
	}
}
