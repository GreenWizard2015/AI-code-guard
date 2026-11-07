import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { ProjectSourceContextImports } from "src/core/project-source/project_source_context_imports";
import { ProjectSourceImports } from "src/core/project-source/project_source_imports";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { TypeScriptModuleExports } from "src/parser/analysis/type_script_module_exports";
import { TestFixture } from "tests/core/test-fixture";
import ts from "typescript";

describe("TypeScript reference project root", () => {
	test("resolves imports against the selected project root", () => {
		const root = "/virtual/typescript-project-root";
		const factory_file = join(root, "src/factory.ts");
		const entry_file = join(root, "entry.ts");
		const factory_text = 'export function create(): string { return "target"; }\n';
		const entry_text = 'import { create } from "factory";\n';
		const texts = new Map([
			[factory_file, factory_text],
			[entry_file, entry_text],
		]);
		const source = ts.createSourceFile(entry_file, entry_text, ts.ScriptTarget.Latest, true);
		const statement = source.statements.find(ts.isImportDeclaration);
		const resolver = new TypeScriptModuleExports(
			root,
			new Map([[factory_file, ts.createSourceFile(factory_file, factory_text, ts.ScriptTarget.Latest, true)]]),
			false,
			new InMemoryProjectSourceIO(texts),
		);
		let result = "";
		if (statement !== undefined) {
			result = resolver.imported_file(source, statement);
		}

		expect(result).toBe(factory_file);
	});

	test("keeps relative imports inside the selected project root", () => {
		const root = "/virtual/typescript-relative-project-root";
		const factory_file = join(root, "src/factory.ts");
		const entry_file = join(root, "entry.ts");
		const factory_text = 'export function create(): string { return "target"; }\n';
		const entry_text = 'import { create } from "./src/factory";\n';
		const texts = new Map([
			[factory_file, factory_text],
			[entry_file, entry_text],
		]);
		const source = ts.createSourceFile(entry_file, entry_text, ts.ScriptTarget.Latest, true);
		const statement = source.statements.find(ts.isImportDeclaration);
		const resolver = new TypeScriptModuleExports(
			root,
			new Map([[factory_file, ts.createSourceFile(factory_file, factory_text, ts.ScriptTarget.Latest, true)]]),
			false,
			new InMemoryProjectSourceIO(texts),
		);
		let result = "";
		if (statement !== undefined) {
			result = resolver.imported_file(source, statement);
		}

		expect(result).toBe(factory_file);
	});

	test("does not resolve a TypeScript import to a Python module", () => {
		const root = "/virtual/typescript-import-language";
		const entry = join(root, "entry.ts");
		const helper = join(root, "helper.py");
		const project_source_imports = new ProjectSourceImports(root);

		expect(project_source_imports.specifier_path(entry, "./helper", new Set([entry, helper]))).toBe("");
	});

	test("resolves compiler path aliases from the project configuration", () => {
		const root = "/virtual/typescript-compiler-path-alias";
		const config_file = join(root, "tsconfig.json");
		const worker = join(root, "src/domain/worker.ts");
		const entry = join(root, "entry.ts");
		const worker_text = "export const value = 1;\n";
		const entry_text = 'import { value } from "@domain/worker";\n';
		const texts = new Map([
			[config_file, JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@domain/*": ["src/domain/*"] } } })],
			[worker, worker_text],
			[entry, entry_text],
		]);
		const source = ts.createSourceFile(entry, entry_text, ts.ScriptTarget.Latest, true);
		const statement = source.statements.find(ts.isImportDeclaration);
		const resolver = new TypeScriptModuleExports(
			root,
			new Map([[worker, ts.createSourceFile(worker, worker_text, ts.ScriptTarget.Latest, true)]]),
			false,
			new InMemoryProjectSourceIO(texts),
		);
		let actual = "";
		if (statement !== undefined) {
			actual = resolver.imported_file(source, statement);
		}

		expect(actual).toBe(worker);
	});

	test("resolves compiler path aliases from a shared source context", () => {
		const fixture = new TestFixture();
		const result = fixture._project_source.with_in_memory_project(
			{
				"src/domain/worker.ts": ['export class Worker { public value(): string { return "ok"; } }', ""].join("\n"),
				"entry.ts": ['import { Worker } from "@domain/worker";', "new Worker();", ""].join("\n"),
			},
			({ root, context, files, source_texts }) => {
				const entry = join(root, "entry.ts");
				const worker = join(root, "src/domain/worker.ts");
				source_texts.set(
					join(root, "tsconfig.json"),
					JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@domain/*": ["src/domain/*"] } } }),
				);
				const project_imports = new ProjectSourceContextImports(
					root,
					context,
					new InMemoryProjectSourceIO(source_texts),
				);
				return {
					files: files.length,
					actual: project_imports.resolve(entry, "@domain/worker").path(),
					expected: worker,
				};
			},
			new Map(),
		);

		expect(result).toEqual({ files: 2, actual: result.expected, expected: result.expected });
	});

	test("resolves imported declarations from the imported module", () => {
		const fixture = new TestFixture();
		const result = fixture._project_source.with_in_memory_project(
			{
				"src/domain/worker.ts": ['export class Worker { public value(): string { return "ok"; } }', ""].join("\n"),
				"entry.ts": ['import { Worker } from "@domain/worker";', "new Worker();", ""].join("\n"),
			},
			({ root, context, source_texts }) => {
				source_texts.set(
					join(root, "tsconfig.json"),
					JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@domain/*": ["src/domain/*"] } } }),
				);
				const worker = join(root, "src/domain/worker.ts");
				const imports = new ProjectSourceContextImports(root, context, new InMemoryProjectSourceIO(source_texts));
				return {
					actual: imports.resolve(join(root, "entry.ts"), "@domain/worker").declaration_path("Worker"),
					expected: worker,
				};
			},
			new Map(),
		);

		expect(result.actual).toBe(result.expected);
	});
});
