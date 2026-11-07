import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { REPORTING_PROJECT_ROOT } from "src/constants";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import { NodeFileIO } from "src/io/node_file_io";
import { AstDiskCacheFixture } from "tests/bridge/ts/core/ast-disk-cache-fixture";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("ProjectAnalysisIdentity", () => {
	test("uses the installation root for the default analyzer identity", () => {
		const file_io = new NodeFileIO(process.cwd());
		const default_identity = new ProjectAnalysisIdentity(file_io);
		const installation_identity = new ProjectAnalysisIdentity(file_io, REPORTING_PROJECT_ROOT);

		expect(default_identity.analyzer()).toBe(installation_identity.analyzer());
	});

	test("keeps analyzer identity stable", () => {
		const fixture = new AstDiskCacheFixture(new InMemoryFileIO(), "ast-cache-stable-analyzer");
		const identity = new ProjectAnalysisIdentity(fixture._file_io, fixture._analyzer_root);

		expect(identity.analyzer()).toBe(identity.analyzer());
	});

	test("keeps source identity independent of record order and sensitive to content", () => {
		const fixture = new TestFixture();
		const file_io = new NodeFileIO(process.cwd());
		const identity = new ProjectAnalysisIdentity(file_io);

		const records = fixture._project_source.with_in_memory_project(
			{ "src/first.ts": "export const first = 1;", "src/second.ts": "export const second = 2;" },
			({ context }) => context.files(),
			new Map(),
		);
		const reversed_records = [...records];
		reversed_records.reverse();
		const changed_records = records.map((record) => ({ ...record, text: `${record.text} changed` }));
		const original_identity = identity.context(records);

		expect({
			ordered: original_identity,
			reversed: identity.context(reversed_records),
		}).toEqual({ ordered: original_identity, reversed: original_identity });
		expect(identity.context(changed_records)).not.toBe(original_identity);
	});

	test("includes new project directories in the directory identity", () => {
		const fixture = new AstDiskCacheFixture(new InMemoryFileIO(), "ast-cache-directory-identity");
		const identity = new ProjectAnalysisIdentity(fixture._file_io, fixture._analyzer_root);
		const before = identity.directory_context(fixture._root);
		fixture._file_io.create_directory(fixture.path("src/nested"));

		expect(identity.directory_context(fixture._root)).not.toBe(before);
	});

	test("ignores generated directories in the directory identity", () => {
		const fixture = new AstDiskCacheFixture(new InMemoryFileIO(), "ast-cache-ignore-directory-identity");
		const identity = new ProjectAnalysisIdentity(fixture._file_io, fixture._analyzer_root);
		fixture.write("node_modules/package.json", "{}\n");
		const before = identity.directory_context(fixture._root);
		fixture._file_io.create_directory(fixture.path("node_modules/generated"));

		expect(identity.directory_context(fixture._root)).toBe(before);
	});

	test("reuses analyzer identity within one analysis session", () => {
		const fixture = new AstDiskCacheFixture(new InMemoryFileIO(), "ast-cache-analyzer-session");
		const identity = new ProjectAnalysisIdentity(fixture._file_io, fixture._analyzer_root);
		const previous = identity.analyzer();
		fixture.write(join(fixture._analyzer_root, "src/rules.ts"), "export const version = 2;\n");

		expect(identity.analyzer()).toBe(previous);
	});

	test("keeps analyzer identity independent from the target project path", () => {
		const fixture = new AstDiskCacheFixture(new InMemoryFileIO(), "ast-cache-target-root");
		const identity_for_first_project = new ProjectAnalysisIdentity(fixture._file_io, fixture._analyzer_root);
		const identity_for_second_project = new ProjectAnalysisIdentity(fixture._file_io, fixture._analyzer_root);

		expect(identity_for_second_project.analyzer()).toBe(identity_for_first_project.analyzer());
	});

	test("keeps selected, ignored, and entry-file set boundaries in selection identity", () => {
		const fixture = new AstDiskCacheFixture(new InMemoryFileIO(), "ast-cache-selection-boundaries");
		const identity = new ProjectAnalysisIdentity(fixture._file_io, fixture._analyzer_root);
		const first = identity.selection(
			new Set(["/project/a.ts"]),
			new Set(["/project/b.ts", "/project/c.ts"]),
			new Set(["/project/d.ts"]),
		);
		const second = identity.selection(
			new Set(["/project/a.ts"]),
			new Set(["/project/b.ts"]),
			new Set(["/project/c.ts", "/project/d.ts"]),
		);

		expect(first).not.toBe(second);
	});
});
