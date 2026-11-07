import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { TypeScriptModuleExportsContext } from "src/module-resolution/exports/type_script_module_exports_context";
import type { TypeScriptModuleExportsContract } from "src/module-resolution/types";
import ts from "typescript";

/** Responsibilities: _cycle graph_, _export results_. **/
export class CyclicNamedExportFixture {
	public readonly entry_file = "/project/index.ts";
	public readonly value_file = "/project/value.ts";
	private readonly _resolver: TypeScriptModuleExportsContract;

	/** Responsibilities: _scenario construction_. **/
	public constructor() {
		const cycle_file = "/project/cycle.ts";
		const source_files = new Map([
			[
				this.entry_file,
				ts.createSourceFile(
					this.entry_file,
					'export { Value } from "./cycle";\nexport { Value } from "./value";\n',
					ts.ScriptTarget.Latest,
					true,
				),
			],
			[cycle_file, ts.createSourceFile(cycle_file, 'export { Value } from "./index";\n', ts.ScriptTarget.Latest, true)],
			[
				this.value_file,
				ts.createSourceFile(this.value_file, "export const Value = 3;\n", ts.ScriptTarget.Latest, true),
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

	/** Responsibilities: _cyclic named export resolution_. **/
	public result(): { file: string; name: string } {
		return this._resolver.resolve({ file: this.entry_file, name: "Value" });
	}
}
