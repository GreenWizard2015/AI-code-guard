import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { TypeScriptModuleExportsContext } from "src/module-resolution/exports/type_script_module_exports_context";
import { ResolvedTypeScriptDeclarationKind } from "src/module-resolution/types";
import ts from "typescript";
describe("coding-lint shared source precedence and reader isolation", () => {
	test("skips a missing earlier module candidate", () => {
		const root = "/virtual/shared-source-precedence";
		const consumer_file = join(root, "consumer.ts");
		const generated_ts = join(root, "generated.ts");
		const generated_tsx = join(root, "generated.tsx");
		const consumer_text = 'import { Generated } from "./generated";\nexport type Consumer = Generated;\n';
		const generated_tsx_text = "export type Generated = string;\n";
		const source_files = new Map([
			[consumer_file, ts.createSourceFile(consumer_file, consumer_text, ts.ScriptTarget.Latest, true)],
			[generated_tsx, ts.createSourceFile(generated_tsx, generated_tsx_text, ts.ScriptTarget.Latest, true)],
		]);
		const source_io = new InMemoryProjectSourceIO(
			new Map([
				[consumer_file, consumer_text],
				[generated_ts, "export type Generated = number;\n"],
				[generated_tsx, generated_tsx_text],
			]),
		);
		const exports_context = new TypeScriptModuleExportsContext(root, source_files, false, source_io);
		const resolver = exports_context.module_exports();

		expect(resolver.module_symbol(consumer_file, "./generated")).toBe(generated_tsx);
	});

	test("uses only the shared source map when filesystem fallback is disabled", () => {
		const root = "/virtual/shared-source-policy";
		const consumer_file = join(root, "consumer.ts");
		const generated_file = join(root, "generated.ts");
		const consumer_text = 'import { Generated } from "./generated";\nexport type Consumer = Generated;\n';
		const generated_text = "export type Generated = number;\n";
		const source_map = new Map([
			[consumer_file, ts.createSourceFile(consumer_file, consumer_text, ts.ScriptTarget.Latest, true)],
		]);
		const source_io = new InMemoryProjectSourceIO(
			new Map([
				[consumer_file, consumer_text],
				[generated_file, generated_text],
			]),
		);
		const disk_context = new TypeScriptModuleExportsContext(root, source_map, true, source_io);
		const disk_resolver = disk_context.module_exports();
		const snapshot_context = new TypeScriptModuleExportsContext(root, source_map, false, source_io);
		const snapshot_resolver = snapshot_context.module_exports();

		expect({
			disk: disk_resolver.module_symbol(consumer_file, "./generated"),
			snapshot: snapshot_resolver.module_symbol(consumer_file, "./generated"),
			resolved: disk_resolver.resolve({ file: generated_file, name: "Generated" }).file,
		}).toEqual({ disk: generated_file, snapshot: "", resolved: generated_file });
	});

	test("resolves an explicit runtime module included in the source snapshot", () => {
		const root = "/virtual/shared-runtime-module";
		const consumer_file = join(root, "consumer.ts");
		const runtime_file = join(root, "worker.mjs");
		const consumer_text = 'import { Worker } from "./worker.mjs";\n';
		const source_files = new Map([
			[consumer_file, ts.createSourceFile(consumer_file, consumer_text, ts.ScriptTarget.Latest, true)],
		]);
		const source_io = new InMemoryProjectSourceIO(
			new Map([
				[consumer_file, consumer_text],
				[runtime_file, "export class Worker {}\n"],
			]),
		);
		const exports_context = new TypeScriptModuleExportsContext(root, source_files, false, source_io);
		const resolver = exports_context.module_exports();

		expect({
			module: resolver.module_symbol(consumer_file, "./worker.mjs"),
			declaration: resolver.resolve({ file: runtime_file, name: "Worker" }).file,
			kind: resolver.symbol_kind({ file: runtime_file, name: "Worker" }),
		}).toEqual({ module: runtime_file, declaration: runtime_file, kind: ResolvedTypeScriptDeclarationKind.Class });
	});

	test("resolves a runtime import to its matching declaration module", () => {
		const root = "/virtual/runtime-declaration-module";
		const consumer_file = join(root, "consumer.ts");
		const runtime_file = join(root, "worker.mjs");
		const declaration_file = join(root, "worker.d.mts");
		const consumer_text = 'import { Worker } from "./worker.mjs";';
		const source_files = new Map([
			[consumer_file, ts.createSourceFile(consumer_file, consumer_text, ts.ScriptTarget.Latest, true)],
			[
				declaration_file,
				ts.createSourceFile(declaration_file, "export declare class Worker {}", ts.ScriptTarget.Latest, true),
			],
		]);
		const source_io = new InMemoryProjectSourceIO(
			new Map([
				[consumer_file, consumer_text],
				[runtime_file, "export class Worker {}"],
				[declaration_file, "export declare class Worker {}"],
			]),
		);
		const exports_context = new TypeScriptModuleExportsContext(root, source_files, false, source_io);
		const resolver = exports_context.module_exports();

		expect(resolver.module_symbol(consumer_file, "./worker.mjs")).toBe(declaration_file);
	});

	test.each([
		[".mjs", ".mts"],
		[".cjs", ".cts"],
	])("resolves %s imports to source module kind %s", (runtime_extension, source_extension) => {
		const root = "/virtual/source-module-kinds";
		const consumer_file = join(root, "consumer.ts");
		const module_file = join(root, `worker${source_extension}`);
		const source_files = new Map([
			[consumer_file, ts.createSourceFile(consumer_file, "", ts.ScriptTarget.Latest, true)],
			[module_file, ts.createSourceFile(module_file, "export class Worker {}\n", ts.ScriptTarget.Latest, true)],
		]);
		const source_io = new InMemoryProjectSourceIO(new Map([[module_file, "export class Worker {}\n"]]));
		const exports_context = new TypeScriptModuleExportsContext(root, source_files, false, source_io);
		const resolver = exports_context.module_exports();

		expect(resolver.module_symbol(consumer_file, `./worker${runtime_extension}`)).toBe(module_file);
	});

	test("does not share module results between readers over the same source map", () => {
		const root = "/virtual/shared-source-reader-cache";
		const consumer_file = join(root, "consumer.ts");
		const helper_file = join(root, "helper.mjs");
		const consumer_text = 'import { Helper } from "./helper.mjs";\n';
		const source_files = new Map([
			[consumer_file, ts.createSourceFile(consumer_file, consumer_text, ts.ScriptTarget.Latest, true)],
		]);
		const first_reader = new InMemoryProjectSourceIO(new Map([[helper_file, "export class Helper {}\n"]]));
		const second_reader = new InMemoryProjectSourceIO(new Map());
		const first_context = new TypeScriptModuleExportsContext(root, source_files, false, first_reader);
		const first_resolver = first_context.module_exports();
		const second_context = new TypeScriptModuleExportsContext(root, source_files, false, second_reader);
		const second_resolver = second_context.module_exports();

		const first_result = first_resolver.module_symbol(consumer_file, "./helper.mjs");
		const second_result = second_resolver.module_symbol(consumer_file, "./helper.mjs");

		expect({ first_result, second_result }).toEqual({ first_result: helper_file, second_result: "" });
	});
});
