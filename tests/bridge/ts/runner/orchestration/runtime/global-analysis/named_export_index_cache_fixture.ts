import ts from "typescript";
import { EmptySourceText } from "src/io/empty_source_text";
import { TypeScriptModuleExports } from "src/module-resolution/type_script_module_exports";

/** Responsibilities: _index cache_, _cache observations_. **/
export class NamedExportIndexCacheFixture {
	public readonly barrel_file = "/project/index.ts";
	public readonly value_file = "/project/value.ts";
	private readonly first_resolver: TypeScriptModuleExports;
	private readonly second_resolver: TypeScriptModuleExports;
	private statement_reads = 0;

	/** Responsibilities: _scenario construction_. **/
	public constructor() {
		const barrel_source = ts.createSourceFile(
			this.barrel_file,
			'export { Value } from "./value";\n',
			ts.ScriptTarget.Latest,
			true,
		);
		const statements = barrel_source.statements;
		Object.defineProperty(barrel_source, "statements", {
			configurable: true,
			get: () => {
				this.statement_reads += 1;
				return statements;
			},
		});
		const source_files = new Map([
			[this.barrel_file, barrel_source],
			[
				this.value_file,
				ts.createSourceFile(this.value_file, "export const Value = 1;\n", ts.ScriptTarget.Latest, true),
			],
		]);
		const source_io = new EmptySourceText();
		this.first_resolver = new TypeScriptModuleExports("/project", source_files, false, source_io);
		this.second_resolver = new TypeScriptModuleExports("/project", source_files, false, source_io);
	}

	/** Responsibilities: _named export index_. **/
	public shared_index_observation(): { first: string; second: string; reads_unchanged: boolean } {
		const first = this.first_resolver.resolve(this.barrel_file, "Value");
		const reads_after_first = this.statement_reads;
		const second = this.second_resolver.resolve(this.barrel_file, "Value");
		return {
			first: first.file,
			second: second.file,
			reads_unchanged: this.statement_reads === reads_after_first,
		};
	}
}
