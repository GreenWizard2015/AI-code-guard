import ts from "typescript";
import { EmptySourceText } from "src/io/empty_source_text";
import { TypeScriptModuleExports } from "src/module-resolution/type_script_module_exports";

/** Responsibilities: _cycle graph_, _export results_. **/
export class CyclicNamedExportFixture {
	public readonly entry_file = "/project/index.ts";
	public readonly value_file = "/project/value.ts";
	private readonly resolver: TypeScriptModuleExports;

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
		this.resolver = new TypeScriptModuleExports("/project", source_files, false, new EmptySourceText());
	}

	/** Responsibilities: _cyclic named export resolution_. **/
	public result(): { file: string; name: string } {
		return this.resolver.resolve(this.entry_file, "Value");
	}
}
