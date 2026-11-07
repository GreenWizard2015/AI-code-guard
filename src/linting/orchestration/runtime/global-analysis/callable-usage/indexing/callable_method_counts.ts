import { PYTHON_LANGUAGE, TYPESCRIPT_LANGUAGE } from "src/constants";
import type { CallableDefinition, CallableMethodCountsByName } from "src/metrics/types";
import type { AstLanguage } from "src/model/ast/normalized_ast_types";
import type { CallableMethodCountsContract } from "src/shared_services_protocols";

/** Responsibilities: _method counts_, _method names_. **/
export class CallableMethodCounts implements CallableMethodCountsContract {
	private readonly _counts: Map<AstLanguage, CallableMethodCountsByName>;

	/** Responsibilities: _callable source language_. **/
	private language_for_file(file: string): AstLanguage {
		if (file.endsWith(".py")) {
			return PYTHON_LANGUAGE;
		}
		return TYPESCRIPT_LANGUAGE;
	}

	/** Responsibilities: _field initialization_. **/
	public constructor() {
		this._counts = new Map<AstLanguage, CallableMethodCountsByName>();
	}

	/** Responsibilities: _method count accumulation_. **/
	public append(definition: CallableDefinition): void {
		if (definition.kind !== "method") {
			return;
		}
		const language = this.language_for_file(definition.file);
		const name = definition.node.identity.name;
		let language_counts = this._counts.get(language);
		if (language_counts === undefined) {
			language_counts = new Map<string, number>();
			this._counts.set(language, language_counts);
		}
		let count = language_counts.get(name);
		if (count === undefined) {
			count = 0;
		}
		language_counts.set(name, count + 1);
	}

	/** Responsibilities: _output count method name_. **/
	public count(name: string, language: AstLanguage): number {
		const language_counts = this._counts.get(language);
		if (language_counts === undefined) {
			return 0;
		}
		const count = language_counts.get(name);
		if (count === undefined) {
			return 0;
		}
		return count;
	}
}
