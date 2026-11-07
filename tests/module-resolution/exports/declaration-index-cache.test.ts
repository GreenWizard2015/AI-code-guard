import { describe, expect, test } from "@jest/globals";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { TypeScriptModuleExportsContext } from "src/module-resolution/exports/type_script_module_exports_context";
import ts from "typescript";

describe("TypeScript declaration index cache", () => {
	test("resolves declarations consistently across resolver instances", () => {
		const file = "/project/shared.ts";
		const source_file = ts.createSourceFile(
			file,
			"export type First = string; export type Later = number;",
			ts.ScriptTarget.Latest,
			true,
		);
		const source_files = new Map([[file, source_file]]);
		const source_io = new InMemoryProjectSourceIO(new Map<string, string>());
		const module_context = new TypeScriptModuleExportsContext("/project", source_files, false, source_io);
		const resolver = module_context.module_exports();
		const first = resolver.resolve({ file, name: "Later" });
		const second_context = new TypeScriptModuleExportsContext("/project", source_files, false, source_io);
		const second = second_context.module_exports().resolve({ file, name: "Later" });

		expect({ first, second }).toEqual({
			first: { file, name: "Later" },
			second: { file, name: "Later" },
		});
	});

	test("returns resolved exports before recursive lookup on cache hits", () => {
		const file = "/project/cached.ts";
		const source_file = ts.createSourceFile(file, "export type Value = string;", ts.ScriptTarget.Latest, true);
		const source_io = new InMemoryProjectSourceIO(new Map<string, string>());
		const module_context = new TypeScriptModuleExportsContext(
			"/project",
			new Map([[file, source_file]]),
			false,
			source_io,
		);
		const resolver = module_context.module_exports();
		const first = resolver.resolve({ file, name: "Value" });
		const second = resolver.resolve({ file, name: "Value" });

		expect({ first, second, same_result: first === second }).toEqual({
			first: { file, name: "Value" },
			second: { file, name: "Value" },
			same_result: true,
		});
	});

	test("keeps indexes separate for different SourceFile identities", () => {
		const first_file = ts.createSourceFile(
			"/project/first.ts",
			"export type Value = string;",
			ts.ScriptTarget.Latest,
			true,
		);
		const second_file = ts.createSourceFile(
			"/project/second.ts",
			"export type Value = number;",
			ts.ScriptTarget.Latest,
			true,
		);
		const source_files = new Map([
			[first_file.fileName, first_file],
			[second_file.fileName, second_file],
		]);
		const source_io = new InMemoryProjectSourceIO(new Map<string, string>());
		const module_context = new TypeScriptModuleExportsContext("/project", source_files, false, source_io);
		const resolver = module_context.module_exports();
		const first = resolver.resolve({ file: first_file.fileName, name: "Value" });
		const second = resolver.resolve({ file: second_file.fileName, name: "Value" });
		expect([first, second]).toEqual([
			{ file: first_file.fileName, name: "Value" },
			{ file: second_file.fileName, name: "Value" },
		]);
	});

	test("shares named export indexes for one SourceFile identity", () => {
		const barrel_file = "/project/index.ts";
		const value_file = "/project/value.ts";
		const source_files = new Map([
			[
				barrel_file,
				ts.createSourceFile(barrel_file, 'export { Value } from "./value";\n', ts.ScriptTarget.Latest, true),
			],
			[value_file, ts.createSourceFile(value_file, "export const Value = 1;\n", ts.ScriptTarget.Latest, true)],
		]);
		const source_io = new InMemoryProjectSourceIO(new Map<string, string>());
		const module_context = new TypeScriptModuleExportsContext("/project", source_files, false, source_io);
		const resolver = module_context.module_exports();
		const result = resolver.resolve({ file: barrel_file, name: "Value" });
		const second_context = new TypeScriptModuleExportsContext("/project", source_files, false, source_io);
		const second_resolver = second_context.module_exports();
		const second_result = second_resolver.resolve({ file: barrel_file, name: "Value" });

		expect({ result, second_result }).toEqual({
			result: { file: value_file, name: "Value" },
			second_result: { file: value_file, name: "Value" },
		});
	});

	test("keeps duplicate named export fallback order", () => {
		const barrel_file = "/project/index.ts";
		const value_file = "/project/value.ts";
		const source_files = new Map([
			[
				barrel_file,
				ts.createSourceFile(
					barrel_file,
					'export { Value } from "./missing";\nexport { Value } from "./value";\n',
					ts.ScriptTarget.Latest,
					true,
				),
			],
			[
				"/project/missing.ts",
				ts.createSourceFile("/project/missing.ts", "export const Other = 1;\n", ts.ScriptTarget.Latest, true),
			],
			[value_file, ts.createSourceFile(value_file, "export const Value = 2;\n", ts.ScriptTarget.Latest, true)],
		]);
		const source_io = new InMemoryProjectSourceIO(new Map<string, string>());
		const exports_context = new TypeScriptModuleExportsContext("/project", source_files, false, source_io);
		const resolver = exports_context.module_exports();
		const resolved = resolver.resolve({ file: barrel_file, name: "Value" });

		expect(resolved).toEqual({ file: value_file, name: "Value" });
	});

	test("keeps fallback after a cyclic named export", () => {
		const entry_file = "/project/index.ts";
		const value_file = "/project/value.ts";
		const source_files = new Map([
			[
				entry_file,
				ts.createSourceFile(
					entry_file,
					'export { Value } from "./cycle";\nexport { Value } from "./value";\n',
					ts.ScriptTarget.Latest,
					true,
				),
			],
			[
				"/project/cycle.ts",
				ts.createSourceFile("/project/cycle.ts", 'export { Value } from "./index";\n', ts.ScriptTarget.Latest, true),
			],
			[value_file, ts.createSourceFile(value_file, "export const Value = 3;\n", ts.ScriptTarget.Latest, true)],
		]);
		const source_io = new InMemoryProjectSourceIO(new Map<string, string>());
		const exports_context = new TypeScriptModuleExportsContext("/project", source_files, false, source_io);
		const resolver = exports_context.module_exports();
		const resolved = resolver.resolve({ file: entry_file, name: "Value" });

		expect(resolved).toEqual({ file: value_file, name: "Value" });
	});

	test("shares project resolution across module resolver instances", () => {
		const file = "/project/shared.ts";
		const source_file = ts.createSourceFile(file, "export type Value = string;", ts.ScriptTarget.Latest, true);
		const source_files = new Map([[file, source_file]]);
		const source_io = new InMemoryProjectSourceIO(new Map<string, string>());
		const resolvers = Array.from({ length: 2 }, () => {
			const module_resolver_context = new TypeScriptModuleExportsContext("/project", source_files, false, source_io);
			return module_resolver_context.module_exports();
		});
		const results = resolvers.map((resolver_instance) => resolver_instance.resolve({ file, name: "Value" }));

		expect({ resolver_count: resolvers.length, results }).toEqual({
			resolver_count: 2,
			results: [
				{ file, name: "Value" },
				{ file, name: "Value" },
			],
		});
	});
});
