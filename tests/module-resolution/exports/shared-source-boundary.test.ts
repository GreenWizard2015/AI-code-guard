import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { TypeScriptModuleExportsContext } from "src/module-resolution/exports/type_script_module_exports_context";
import ts from "typescript";

describe("coding-lint shared source boundaries", () => {
	test("does not read an imported file outside the shared source boundary", () => {
		const root = "/virtual/shared-source-boundary";
		const consumer_file = join(root, "consumer.ts");
		const generated_file = join(root, "generated.ts");
		const consumer_text = 'import { Generated } from "./generated";\nexport type Consumer = Generated;\n';
		const generated_text = "export type Generated = string;\n";
		const source_map = new Map([
			[consumer_file, ts.createSourceFile(consumer_file, consumer_text, ts.ScriptTarget.Latest, true)],
		]);
		const source_io = new InMemoryProjectSourceIO(
			new Map([
				[consumer_file, consumer_text],
				[generated_file, generated_text],
			]),
		);
		const exports_context = new TypeScriptModuleExportsContext(root, source_map, false, source_io);
		const resolver = exports_context.module_exports();

		expect(resolver.resolve({ file: generated_file, name: "Generated" }).file).toBe("");
	});

	test("resolves a declaration present in the shared source boundary", () => {
		const root = "/virtual/shared-source-present";
		const consumer_file = join(root, "consumer.ts");
		const generated_file = join(root, "generated.ts");
		const consumer_text = 'import { Generated } from "./generated";\nexport type Consumer = Generated;\n';
		const generated_text = "export type Generated = string;\n";
		const source_files = new Map([
			[consumer_file, ts.createSourceFile(consumer_file, consumer_text, ts.ScriptTarget.Latest, true)],
			[generated_file, ts.createSourceFile(generated_file, generated_text, ts.ScriptTarget.Latest, true)],
		]);
		const exports_context = new TypeScriptModuleExportsContext(
			root,
			source_files,
			false,
			new InMemoryProjectSourceIO(
				new Map([
					[consumer_file, consumer_text],
					[generated_file, generated_text],
				]),
			),
		);
		const resolver = exports_context.module_exports();

		expect(resolver.resolve({ file: generated_file, name: "Generated" }).file).toBe(generated_file);
	});

	test("resolves renamed symbols through chained named and star exports", () => {
		const root = "/virtual/chained-export-resolution";
		const declaration_file = join(root, "declaration.ts");
		const named_export_file = join(root, "named-export.ts");
		const star_export_file = join(root, "star-export.ts");
		const sources = new Map([
			[declaration_file, "export class Original {}\n"],
			[named_export_file, 'export { Original as Renamed } from "./declaration";\n'],
			[star_export_file, 'export * from "./named-export";\n'],
		]);
		const source_files = new Map<string, ts.SourceFile>();
		for (const [file, text] of sources) {
			source_files.set(file, ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true));
		}
		const exports_context = new TypeScriptModuleExportsContext(
			root,
			source_files,
			false,
			new InMemoryProjectSourceIO(sources),
		);
		const resolver = exports_context.module_exports();

		expect(resolver.resolve({ file: star_export_file, name: "Renamed" })).toEqual({
			file: declaration_file,
			name: "Original",
		});
	});
});
