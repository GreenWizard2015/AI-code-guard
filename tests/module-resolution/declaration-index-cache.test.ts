import { describe, expect, jest, test } from "@jest/globals";
import ts from "typescript";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { TypeScriptModuleExports } from "src/module-resolution/type_script_module_exports";
import { TypeScriptProjectResolution } from "src/module-resolution/type_script_project_resolution";

describe("TypeScript declaration index cache", () => {
	test("shares declaration indexes for one SourceFile identity", () => {
		const file = "/project/shared.ts";
		const source_file = ts.createSourceFile(
			file,
			"export type First = string; export type Later = number;",
			ts.ScriptTarget.Latest,
			true,
		);
		const statements = source_file.statements;
		let statement_reads = 0;
		Object.defineProperty(source_file, "statements", {
			configurable: true,
			get: () => {
				statement_reads += 1;
				return statements;
			},
		});
		const source_files = new Map([[file, source_file]]);
		const source_io = new InMemoryProjectSourceIO(new Map<string, string>());
		const first_resolver = new TypeScriptModuleExports("/project", source_files, false, source_io);
		const second_resolver = new TypeScriptModuleExports("/project", source_files, false, source_io);

		first_resolver.resolve(file, "Later");
		second_resolver.resolve(file, "Later");

		expect(statement_reads).toBe(1);
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
		let first_reads = 0;
		let second_reads = 0;
		const first_statements = first_file.statements;
		const second_statements = second_file.statements;
		Object.defineProperty(first_file, "statements", {
			configurable: true,
			get: () => {
				first_reads += 1;
				return first_statements;
			},
		});
		Object.defineProperty(second_file, "statements", {
			configurable: true,
			get: () => {
				second_reads += 1;
				return second_statements;
			},
		});
		const source_files = new Map([
			[first_file.fileName, first_file],
			[second_file.fileName, second_file],
		]);
		const source_io = new InMemoryProjectSourceIO(new Map<string, string>());
		const resolver = new TypeScriptModuleExports("/project", source_files, false, source_io);

		resolver.resolve(first_file.fileName, "Value");
		resolver.resolve(second_file.fileName, "Value");

		expect({ first: first_reads > 0, second: second_reads > 0 }).toEqual({ first: true, second: true });
	});

	test("shares named export indexes for one SourceFile identity", () => {
		const barrel_file = "/project/index.ts";
		const value_file = "/project/value.ts";
		const barrel_source = ts.createSourceFile(
			barrel_file,
			'export { Value } from "./value";\n',
			ts.ScriptTarget.Latest,
			true,
		);
		const statements = barrel_source.statements;
		let statement_reads = 0;
		Object.defineProperty(barrel_source, "statements", {
			configurable: true,
			get: () => {
				statement_reads += 1;
				return statements;
			},
		});
		const source_files = new Map([
			[barrel_file, barrel_source],
			[value_file, ts.createSourceFile(value_file, "export const Value = 1;\n", ts.ScriptTarget.Latest, true)],
		]);
		const source_io = new InMemoryProjectSourceIO(new Map<string, string>());
		const first_resolver = new TypeScriptModuleExports("/project", source_files, false, source_io);
		const second_resolver = new TypeScriptModuleExports("/project", source_files, false, source_io);
		const first = first_resolver.resolve(barrel_file, "Value");
		const reads_after_first = statement_reads;
		const second = second_resolver.resolve(barrel_file, "Value");

		expect({ first: first.file, second: second.file, reads_unchanged: statement_reads === reads_after_first }).toEqual({
			first: value_file,
			second: value_file,
			reads_unchanged: true,
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
		const resolver = new TypeScriptModuleExports("/project", source_files, false, source_io);
		const resolved = resolver.resolve(barrel_file, "Value");

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
		const resolver = new TypeScriptModuleExports("/project", source_files, false, source_io);
		const resolved = resolver.resolve(entry_file, "Value");

		expect(resolved).toEqual({ file: value_file, name: "Value" });
	});

	test("shares project resolution across module resolver instances", () => {
		const file = "/project/shared.ts";
		const source_file = ts.createSourceFile(file, "export type Value = string;", ts.ScriptTarget.Latest, true);
		const source_files = new Map([[file, source_file]]);
		const source_io = new InMemoryProjectSourceIO(new Map<string, string>());
		const resolution = jest.spyOn(TypeScriptProjectResolution.prototype, "resolution");

		const resolvers = Array.from(
			{ length: 2 },
			() => new TypeScriptModuleExports("/project", source_files, false, source_io),
		);
		const resolution_calls = resolution.mock.calls.length;
		resolution.mockRestore();

		expect({ resolver_count: resolvers.length, resolution_calls }).toEqual({ resolver_count: 2, resolution_calls: 1 });
	});
});
