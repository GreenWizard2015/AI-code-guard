import ts from "typescript";
import { EmptySourceText } from "src/io/empty_source_text";
import { TypeScriptModuleExports } from "src/module-resolution/type_script_module_exports";

/** Responsibilities: _duplicate exports_, _export choice_. **/
export class DuplicateNamedExportFixture {
	public readonly barrel_file = "/project/index.ts";
	public readonly value_file = "/project/value.ts";
	private readonly resolver: TypeScriptModuleExports;

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
		this.resolver = new TypeScriptModuleExports("/project", source_files, false, new EmptySourceText());
	}

	/** Responsibilities: _duplicate named export resolution_. **/
	public result(): { file: string; name: string } {
		return this.resolver.resolve(this.barrel_file, "Value");
	}
}
