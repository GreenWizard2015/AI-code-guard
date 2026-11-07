import { describe, expect, test } from "@jest/globals";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { TypeScriptCompositionModel } from "src/linting/composition/type_script_composition_model";
import { TypeScriptModuleExportsContext } from "src/module-resolution/exports/type_script_module_exports_context";
import ts from "typescript";

describe("module specifier cache ownership", () => {
	const source_io = new InMemoryProjectSourceIO(new Map());
	test("retains composition import identities when several files share a module", () => {
		const target = ts.createSourceFile(
			"/project/src/shared.ts",
			"export class Shared {}",
			ts.ScriptTarget.Latest,
			true,
		);
		const first = ts.createSourceFile(
			"/project/one.ts",
			'import { Shared } from "src/shared";',
			ts.ScriptTarget.Latest,
			true,
		);
		const second = ts.createSourceFile(
			"/project/two.ts",
			'import { Shared } from "src/shared";',
			ts.ScriptTarget.Latest,
			true,
		);
		const sources = new Map([
			[target.fileName, target],
			[first.fileName, first],
			[second.fileName, second],
		]);
		const exports_context = new TypeScriptModuleExportsContext("/project", sources, false, source_io);
		const resolver = exports_context.module_exports();
		const first_model = new TypeScriptCompositionModel(first.fileName, first, resolver);
		const second_model = new TypeScriptCompositionModel(second.fileName, second, resolver);
		const first_imports = [...first_model.imports()];
		const second_imports = [...second_model.imports()];
		expect({ first_imports, second_imports }).toEqual({
			first_imports: [["Shared", { file: target.fileName, name: "Shared" }]],
			second_imports: [["Shared", { file: target.fileName, name: "Shared" }]],
		});
	});

	test("resolves a non-relative module across importers and resolvers", () => {
		const file = "/project/src/shared.ts";
		const source = ts.createSourceFile(file, "export const VALUE = 1;", ts.ScriptTarget.Latest, true);
		const sources = new Map([[file, source]]);
		const first_context = new TypeScriptModuleExportsContext("/project", sources, false, source_io);
		const first = first_context.module_exports();
		const second_context = new TypeScriptModuleExportsContext("/project", sources, false, source_io);
		const second = second_context.module_exports();
		const first_file = first.module_symbol("/project/one.ts", "src/shared");
		const second_file = second.module_symbol("/project/two.ts", "src/shared");
		expect({ first_file, second_file }).toEqual({ first_file: file, second_file: file });
	});

	test("resolves missing non-relative modules consistently across importers", () => {
		const exports_context = new TypeScriptModuleExportsContext("/project", new Map(), false, source_io);
		const resolver = exports_context.module_exports();
		const first_file = resolver.module_symbol("/project/one.ts", "missing");
		const second_file = resolver.module_symbol("/project/two.ts", "missing");
		expect({ first_file, second_file }).toEqual({ first_file: "", second_file: "" });
	});

	test("keeps relative imports tied to the importing directory", () => {
		const first = ts.createSourceFile(
			"/project/one/shared.ts",
			"export const FIRST = 1;",
			ts.ScriptTarget.Latest,
			true,
		);
		const second = ts.createSourceFile(
			"/project/two/shared.ts",
			"export const SECOND = 2;",
			ts.ScriptTarget.Latest,
			true,
		);
		const exports_context = new TypeScriptModuleExportsContext(
			"/project",
			new Map([
				[first.fileName, first],
				[second.fileName, second],
			]),
			false,
			source_io,
		);
		const resolver = exports_context.module_exports();
		const first_file = resolver.module_symbol("/project/one/use.ts", "./shared");
		const second_file = resolver.module_symbol("/project/two/use.ts", "./shared");
		expect({ first_file, second_file }).toEqual({ first_file: first.fileName, second_file: second.fileName });
	});

	test("keeps non-relative imports separate for different project roots", () => {
		const first = ts.createSourceFile("/one/shared.ts", "export const FIRST = 1;", ts.ScriptTarget.Latest, true);
		const second = ts.createSourceFile("/two/shared.ts", "export const SECOND = 2;", ts.ScriptTarget.Latest, true);
		const sources = new Map([
			[first.fileName, first],
			[second.fileName, second],
		]);
		const first_context = new TypeScriptModuleExportsContext("/one", sources, false, source_io);
		const first_resolver = first_context.module_exports();
		const module_second_context = new TypeScriptModuleExportsContext("/two", sources, false, source_io);
		const second_resolver = module_second_context.module_exports();
		const first_file = first_resolver.module_symbol("/one/use.ts", "shared");
		const second_file = second_resolver.module_symbol("/two/use.ts", "shared");
		expect({ first_file, second_file }).toEqual({ first_file: first.fileName, second_file: second.fileName });
	});
});
