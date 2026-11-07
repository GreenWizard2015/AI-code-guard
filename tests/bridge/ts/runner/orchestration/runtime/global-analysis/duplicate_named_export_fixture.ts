import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { TypeScriptModuleExportsContext } from "src/module-resolution/exports/type_script_module_exports_context";
import type { TypeScriptModuleExportsContract } from "src/module-resolution/types";
import ts from "typescript";

/** Responsibilities: _duplicate exports_, _export choice_. **/
export class DuplicateNamedExportFixture {
	public readonly barrel_file = "/project/index.ts";
	public readonly value_file = "/project/value.ts";
	private readonly _resolver: TypeScriptModuleExportsContract;

	/** Responsibilities: _scenario construction_. **/
	public constructor() {
		const missing_file = "/project/missing.ts";
		const source_files = new Map([
			[
				this.barrel_file,
				ts.createSourceFile(
					this.barrel_file,
					'export { Value } from "./missing";\nexport { Value } from "./value";\n',
					ts.ScriptTarget.Latest,
					true,
				),
			],
			[missing_file, ts.createSourceFile(missing_file, "export const Other = 1;\n", ts.ScriptTarget.Latest, true)],
			[
				this.value_file,
				ts.createSourceFile(this.value_file, "export const Value = 2;\n", ts.ScriptTarget.Latest, true),
			],
		]);
		const resolver_context = new TypeScriptModuleExportsContext(
			"/project",
			source_files,
			false,
			new InMemoryProjectSourceIO(new Map()),
		);
		this._resolver = resolver_context.module_exports();
	}

	/** Responsibilities: _duplicate named export resolution_. **/
	public result(): { file: string; name: string } {
		return this._resolver.resolve({ file: this.barrel_file, name: "Value" });
	}
}
