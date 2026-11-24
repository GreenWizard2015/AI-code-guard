import { describe, expect, test } from "@jest/globals";
import { SourceFileMapCache } from "src/core/project-source/source_file_map_cache";
import ts from "typescript";

describe("source-file map cache", () => {
	test("reuses a resolver for the same map and isolates cache owners", () => {
		const source_files = new Map<string, ts.SourceFile>();
		const cache = new SourceFileMapCache();
		const resolver = cache.for_map(source_files);
		const reused_resolver = cache.for_map(source_files);
		const refreshed_resolver = cache.refresh_map(source_files);
		const resolver_after_refresh = cache.for_map(source_files);
		const other_cache = new SourceFileMapCache();
		const other_resolver = other_cache.for_map(source_files);

		expect({
			same: resolver === reused_resolver,
			refreshed: resolver !== refreshed_resolver,
			refresh_reused: resolver_after_refresh === refreshed_resolver,
			isolated: resolver_after_refresh !== other_resolver,
		}).toEqual({
			same: true,
			refreshed: true,
			refresh_reused: true,
			isolated: true,
		});
	});

	test("distinguishes mapped files from missing files", () => {
		const file = "/virtual/project/main.ts";
		const missing_file = "/virtual/project/missing.ts";
		const source_file = ts.createSourceFile(file, "export const value = 1;", ts.ScriptTarget.Latest, true);
		const source_files = new Map([[file, source_file]]);
		const cache = new SourceFileMapCache();
		const resolver = cache.for_map(source_files);
		expect(() => resolver.source_file(missing_file)).toThrow(missing_file);

		expect({
			contains_mapped: resolver.contains_source_file(file),
			contains_missing: resolver.contains_source_file(missing_file),
			found_path: resolver.source_file(file).fileName,
			found: resolver.contains_source_file(file),
			resolved: resolver.source_file(file) === source_file,
			missing: resolver.contains_source_file(missing_file),
		}).toEqual({
			contains_mapped: true,
			contains_missing: false,
			found_path: file,
			found: true,
			resolved: true,
			missing: false,
		});
	});

	test("observes files added after resolver creation", () => {
		const file = "/virtual/project/added.ts";
		const source_file = ts.createSourceFile(file, "export const added = true;", ts.ScriptTarget.Latest, true);
		const source_files = new Map<string, ts.SourceFile>();
		const cache = new SourceFileMapCache();
		const resolver = cache.for_map(source_files);
		const before_update = resolver.contains_source_file(file);
		source_files.set(file, source_file);
		const after_update = resolver.source_file(file);

		expect({
			before: before_update,
			after: after_update === source_file,
		}).toEqual({
			before: false,
			after: true,
		});
	});

	test("keeps separate map contents isolated", () => {
		const file = "/virtual/project/main.ts";
		const first_source = ts.createSourceFile(file, "export const first = 1;", ts.ScriptTarget.Latest, true);
		const second_source = ts.createSourceFile(file, "export const second = 2;", ts.ScriptTarget.Latest, true);
		const first_map = new Map([[file, first_source]]);
		const second_map = new Map([[file, second_source]]);
		const cache = new SourceFileMapCache();
		const first_resolver = cache.for_map(first_map);
		const second_resolver = cache.for_map(second_map);
		expect({
			separate_resolvers: first_resolver !== second_resolver,
			first_source: first_resolver.source_file(file) === first_source,
			second_source: second_resolver.source_file(file) === second_source,
		}).toEqual({ separate_resolvers: true, first_source: true, second_source: true });
	});
});
