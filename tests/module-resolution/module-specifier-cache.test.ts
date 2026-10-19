import { describe, expect, jest, test } from "@jest/globals";
import ts from "typescript";
import { TypeScriptModuleExports } from "src/module-resolution/type_script_module_exports";
import { TypeScriptModulePathCatalog } from "src/module-resolution/type_script_module_path_catalog";
import { TypeScriptCompositionModel } from "src/linting/orchestration/runtime/global-analysis/type_script_composition_model";
import { EmptySourceText } from "src/io/empty_source_text";

describe("module specifier cache ownership", () => {
	const source_io = new EmptySourceText();
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
		const resolver = new TypeScriptModuleExports("/project", sources, false, source_io);
		const first_model = new TypeScriptCompositionModel(first.fileName, first, resolver);
		const second_model = new TypeScriptCompositionModel(second.fileName, second, resolver);
		const first_imports = [...first_model.imports()];
		const second_imports = [...second_model.imports()];
		expect({ first_imports, second_imports }).toEqual({
			first_imports: [["Shared", { file: target.fileName, name: "Shared" }]],
			second_imports: [["Shared", { file: target.fileName, name: "Shared" }]],
		});
	});

	test("resolves one non-relative module once across importers and resolvers", () => {
		const file = "/project/src/shared.ts";
		const source = ts.createSourceFile(file, "export const VALUE = 1;", ts.ScriptTarget.Latest, true);
		const sources = new Map([[file, source]]);
		const first = new TypeScriptModuleExports("/project", sources, false, source_io);
		const second = new TypeScriptModuleExports("/project", sources, false, source_io);
		const candidates = jest.spyOn(TypeScriptModulePathCatalog.prototype, "bases");
		const first_file = first.module_symbol("/project/one.ts", "src/shared");
		const second_file = second.module_symbol("/project/two.ts", "src/shared");
		const searches = candidates.mock.calls.length;
		candidates.mockRestore();
		expect({ first_file, second_file, searches }).toEqual({ first_file: file, second_file: file, searches: 1 });
	});

	test("reuses missing non-relative modules across importers", () => {
		const resolver = new TypeScriptModuleExports("/project", new Map(), false, source_io);
		const candidates = jest.spyOn(TypeScriptModulePathCatalog.prototype, "bases");
		const first_file = resolver.module_symbol("/project/one.ts", "missing");
		const second_file = resolver.module_symbol("/project/two.ts", "missing");
		const searches = candidates.mock.calls.length;
		candidates.mockRestore();
		expect({ first_file, second_file, searches }).toEqual({ first_file: "", second_file: "", searches: 1 });
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
		const resolver = new TypeScriptModuleExports(
			"/project",
			new Map([
				[first.fileName, first],
				[second.fileName, second],
			]),
			false,
			source_io,
		);
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
		const first_resolver = new TypeScriptModuleExports("/one", sources, false, source_io);
		const second_resolver = new TypeScriptModuleExports("/two", sources, false, source_io);
		const first_file = first_resolver.module_symbol("/one/use.ts", "shared");
		const second_file = second_resolver.module_symbol("/two/use.ts", "shared");
		expect({ first_file, second_file }).toEqual({ first_file: first.fileName, second_file: second.fileName });
	});
});
