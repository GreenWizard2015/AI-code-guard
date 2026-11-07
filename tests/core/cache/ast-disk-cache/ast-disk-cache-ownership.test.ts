import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { AstModel } from "src/core/ast_model";
import { AstDiskCache } from "src/core/cache/ast-disk-cache/ast_disk_cache";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { StaticProjectIdentity } from "tests/core/cache/ast-disk-cache/static-project-identity";

describe("AstDiskCache ownership", () => {
	const python_ast_model = new AstModel("python");
	const typescript_ast_model = new AstModel("typescript");

	test("preserves type member maps across cache reloads", () => {
		const root = "/virtual/type-members-cache";
		const source_file = join(root, "module.ts");
		const source_text = "export interface Contract { run(): void; }\n";
		const file_io = new InMemoryFileIO();
		file_io.seed_files(new Map([[source_file, source_text]]));
		const empty_ast = typescript_ast_model.empty_ast_file();
		const ast = {
			...empty_ast,
			references: {
				...empty_ast.references,
				type_members: new Map([["Contract", new Map([["run", "method"]])]]),
			},
		};
		const cache = new AstDiskCache(root, "typescript-project", new StaticProjectIdentity(), "typescript", file_io);
		cache.write(source_file, source_text, ast);
		const restarted_cache = new AstDiskCache(
			root,
			"typescript-project",
			new StaticProjectIdentity(),
			"typescript",
			file_io,
		);
		const members = restarted_cache.content(source_file, source_text).value().references.type_members.get("Contract");

		expect(new Map(members)).toEqual(new Map([["run", "method"]]));
	});

	test("does not reuse normalized AST across project identities", () => {
		const root = "/virtual/project-cache";
		const source_file = join(root, "module.ts");
		const source_text = "export const value = 1;\n";
		const file_io = new InMemoryFileIO();
		file_io.seed_files(new Map([[source_file, source_text]]));
		const ast = typescript_ast_model.empty_ast_file();
		const first_cache = new AstDiskCache(root, "project-a", new StaticProjectIdentity(), "typescript", file_io);
		first_cache.write(source_file, source_text, ast);
		const changed_project_cache = new AstDiskCache(
			root,
			"project-b",
			new StaticProjectIdentity(),
			"typescript",
			file_io,
		);

		expect(changed_project_cache.content(source_file, source_text).present()).toBe(false);
	});

	test("keeps Python and TypeScript cache owners independent", () => {
		const root = "/virtual/cache-owners";
		const source_file = join(root, "module.py");
		const source_text = "value = 1\n";
		const file_io = new InMemoryFileIO();
		file_io.seed_files(new Map([[source_file, source_text]]));
		const python_cache = new AstDiskCache(root, "", new StaticProjectIdentity(), "python", file_io);
		const typescript_cache = new AstDiskCache(
			root,
			"typescript-project",
			new StaticProjectIdentity(),
			"typescript",
			file_io,
		);
		python_cache.write(source_file, source_text, python_ast_model.empty_ast_file());
		typescript_cache.clean_unused_records();
		const python_entry = python_cache.content(source_file, source_text);
		const python_directory = join(root, ".ai-code-guard", "cache", "ast", "python");

		expect(file_io.list_files(python_directory)).toHaveLength(1);
		expect(python_entry.present()).toBe(true);
	});

	test("keeps TypeScript and Python cache owners independent in reverse order", () => {
		const root = "/virtual/cache-owners-reverse";
		const source_file = join(root, "module.ts");
		const source_text = "export const value = 1;\n";
		const file_io = new InMemoryFileIO();
		file_io.seed_files(new Map([[source_file, source_text]]));
		const typescript_cache = new AstDiskCache(
			root,
			"typescript-project",
			new StaticProjectIdentity(),
			"typescript",
			file_io,
		);
		const python_cache = new AstDiskCache(root, "", new StaticProjectIdentity(), "python", file_io);
		typescript_cache.write(source_file, source_text, typescript_ast_model.empty_ast_file());
		python_cache.clean_unused_records();
		const typescript_entry = typescript_cache.content(source_file, source_text);
		const typescript_directory = join(root, ".ai-code-guard", "cache", "ast", "typescript");

		expect(file_io.list_files(typescript_directory)).toHaveLength(1);
		expect(typescript_entry.present()).toBe(true);
	});

	test("removes in-memory cache records after their source disappears", () => {
		const root = "/virtual/stale-cache-source";
		const source_file = join(root, "module.ts");
		const source_text = "export const value = 1;\n";
		const file_io = new InMemoryFileIO();
		file_io.seed_files(new Map([[source_file, source_text]]));
		const cache = new AstDiskCache(root, "project-a", new StaticProjectIdentity(), "typescript", file_io);
		cache.write(source_file, source_text, typescript_ast_model.empty_ast_file());
		const cache_directory = join(root, ".ai-code-guard", "cache", "ast", "typescript");
		file_io.file(source_file).remove_file();
		cache.clean_unused_records();

		expect(file_io.list_files(cache_directory)).toHaveLength(0);
	});
});
