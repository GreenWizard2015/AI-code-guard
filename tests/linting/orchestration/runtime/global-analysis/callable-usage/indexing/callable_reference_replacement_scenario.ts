import type { CallableUsageReferences } from "src/linting/orchestration/runtime/global-analysis/callable-usage/indexing/callable_usage_references";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";

/** Responsibilities: _callable reference replacement_, _owner bucket lookup_. **/
export class CallableReferenceReplacementScenario {
	private readonly _references: CallableUsageReferences;

	/** Responsibilities: _reference replacement dependencies_. **/
	public constructor(references: CallableUsageReferences) {
		this._references = references;
	}

	/** Responsibilities: _source AST replacement_. **/
	public append_source(call: string): void {
		const source = `declare const worker: Worker; worker.${call}();`;
		const source_file = new TypeScriptAstFile("worker.ts", source);
		const ast = source_file.normalized();
		this._references.append_file({
			file: "worker.ts",
			absolute_file: "worker.ts",
			imports: new Set(),
			ast,
			reference_aliases: [],
		});
	}

	/** Responsibilities: _named owner reference count_. **/
	public reference_count(name: string): number {
		const file_references = this._references.snapshot(new Set()).references_by_file.get("worker.ts");
		if (file_references === undefined) {
			return 0;
		}
		return file_references.owned_references("method", name).length;
	}
}
