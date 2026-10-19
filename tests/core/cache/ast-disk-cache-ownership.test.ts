import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { AstModel } from "src/core/ast_model";
import { AstDiskCache } from "src/core/cache/ast_disk_cache";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import type { ProjectAnalysisIdentityContract } from "src/protocols";
import type { LintSourceRecord } from "src/types";

/** Responsibilities: _cache analyzer identity_, _cache project scope identity_. **/
class StaticProjectIdentity implements ProjectAnalysisIdentityContract {
	private readonly analyzer_value: string;

	/** Responsibilities: _test analyzer identity selection_. **/
	public constructor(analyzer_value = "analyzer-v1") {
		this.analyzer_value = analyzer_value;
	}

	/** Responsibilities: _stable analyzer identity_. **/
	public analyzer(): string {
		return this.analyzer_value;
	}

	/** Responsibilities: _content identity_. **/
	public content(value: string): string {
		return value;
	}

	/** Responsibilities: _project context identity_. **/
	public context(records: readonly LintSourceRecord[]): string {
		return String(records.length);
	}

	/** Responsibilities: _directory identity_. **/
	public directory_context(root: string): string {
		return root;
	}

	/** Responsibilities: _selection identity_. **/
	public selection(
		files: ReadonlySet<string>,
		ignored_files: ReadonlySet<string>,
		entry_files: ReadonlySet<string>,
	): string {
		return `${files.size}:${ignored_files.size}:${entry_files.size}`;
	}
}

describe("AstDiskCache ownership", () => {
	const ast_model = new AstModel();

	test("preserves type member maps across cache reloads", () => {
		const root = "/virtual/type-members-cache";
		const source_file = join(root, "module.ts");
		const source_text = "export interface Contract { run(): void; }\n";
		const file_io = new InMemoryFileIO();
		file_io.seed_files(new Map([[source_file, source_text]]));
		const ast = ast_model.empty_ast_file("typescript");
		ast.type_members = new Map([["Contract", new Map([["run", "method"]])]]);
		const cache = new AstDiskCache(root, "typescript-project", new StaticProjectIdentity(), "typescript", file_io);
		cache.write(source_file, source_text, ast);
		const restarted_cache = new AstDiskCache(
			root,
			"typescript-project",
			new StaticProjectIdentity(),
			"typescript",
			file_io,
		);
		const members = restarted_cache.content(source_file, source_text).value().type_members.get("Contract");

		expect(members?.get("run")).toBe("method");
	});

	test("does not reuse normalized AST across project identities", () => {
		const root = "/virtual/project-cache";
		const source_file = join(root, "module.ts");
		const source_text = "export const value = 1;\n";
		const file_io = new InMemoryFileIO();
		file_io.seed_files(new Map([[source_file, source_text]]));
		const ast = ast_model.empty_ast_file("typescript");
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
		python_cache.write(source_file, source_text, ast_model.empty_ast_file("python"));
		typescript_cache.clean_unused_records();
		const python_entry = python_cache.content(source_file, source_text);
		const python_directory = join(root, ".ai-code-guard", "cache", "ast", "python");

		expect(file_io.directory_entries.list_files(python_directory)).toHaveLength(1);
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
		typescript_cache.write(source_file, source_text, ast_model.empty_ast_file("typescript"));
		python_cache.clean_unused_records();
		const typescript_entry = typescript_cache.content(source_file, source_text);
		const typescript_directory = join(root, ".ai-code-guard", "cache", "ast", "typescript");

		expect(file_io.directory_entries.list_files(typescript_directory)).toHaveLength(1);
		expect(typescript_entry.present()).toBe(true);
	});

	test("removes in-memory cache records after their source disappears", () => {
		const root = "/virtual/stale-cache-source";
		const source_file = join(root, "module.ts");
		const source_text = "export const value = 1;\n";
		const file_io = new InMemoryFileIO();
		file_io.seed_files(new Map([[source_file, source_text]]));
		const cache = new AstDiskCache(root, "project-a", new StaticProjectIdentity(), "typescript", file_io);
		cache.write(source_file, source_text, ast_model.empty_ast_file("typescript"));
		const cache_directory = join(root, ".ai-code-guard", "cache", "ast", "typescript");
		file_io.file_operations.remove_file(source_file);
		cache.clean_unused_records();

		expect(file_io.directory_entries.list_files(cache_directory)).toHaveLength(0);
	});
});
