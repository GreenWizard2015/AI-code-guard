import { DocumentationLanguage, ExampleKind } from "documentation_validation/types";
import type { DocumentationExample, DocumentationExampleSourceFile } from "documentation_validation/types";

/** Responsibilities: _Python sandbox example identity_, _example source composition_. **/
export class PythonSandboxRuntimeExampleBuilder {
	private readonly _source_files: DocumentationExampleSourceFile[];

	/** Responsibilities: _example source collection_. **/
	public constructor() {
		this._source_files = [];
	}

	/** Responsibilities: _example source collection_. **/
	public add_source_file(source_file: DocumentationExampleSourceFile): this {
		this._source_files.push(source_file);
		return this;
	}

	/** Responsibilities: _Python example definition_. **/
	public build(): DocumentationExample {
		return {
			rule_id: "python-sandbox-runtime",
			language: DocumentationLanguage.PYTHON,
			kind: ExampleKind.GOOD,
			index: 0,
			text: "",
			source_files: [...this._source_files],
		};
	}
}
