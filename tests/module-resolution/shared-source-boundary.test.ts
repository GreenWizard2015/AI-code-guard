import { describe, expect, test } from "@jest/globals";
import ts from "typescript";
import { TypeScriptModuleExports } from "src/module-resolution/type_script_module_exports";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { join } from "node:path";

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
		const resolver = new TypeScriptModuleExports(root, source_map, false, source_io);

		expect(resolver.resolve(generated_file, "Generated").file).toBe("");
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
		const resolver = new TypeScriptModuleExports(
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

		expect(resolver.resolve(generated_file, "Generated").file).toBe(generated_file);
	});

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
		const resolver = new TypeScriptModuleExports(root, source_files, false, source_io);

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
		const disk_resolver = new TypeScriptModuleExports(root, source_map, true, source_io);
		const snapshot_resolver = new TypeScriptModuleExports(root, source_map, false, source_io);

		expect({
			disk: disk_resolver.module_symbol(consumer_file, "./generated"),
			snapshot: snapshot_resolver.module_symbol(consumer_file, "./generated"),
			resolved: disk_resolver.resolve(generated_file, "Generated").file,
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
		const resolver = new TypeScriptModuleExports(root, source_files, false, source_io);

		expect(resolver.module_symbol(consumer_file, "./worker.mjs")).toBe(runtime_file);
	});
});
