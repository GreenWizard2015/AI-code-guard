import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { NodeFileIO } from "src/io/node_file_io";
import { REPORTING_PROJECT_ROOT } from "src/constants";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import { AstDiskCacheFixture } from "tests/bridge/ts/core/ast-disk-cache-fixture";

describe("ProjectAnalysisIdentity", () => {
	test("uses the installation root for the default analyzer identity", () => {
		const file_io = new NodeFileIO();
		const default_identity = new ProjectAnalysisIdentity(file_io);
		const installation_identity = new ProjectAnalysisIdentity(file_io, REPORTING_PROJECT_ROOT);

		expect(default_identity.analyzer()).toBe(installation_identity.analyzer());
	});

	test("keeps analyzer identity stable", () => {
		const fixture = new AstDiskCacheFixture("ast-cache-stable-analyzer");
		const identity = new ProjectAnalysisIdentity(fixture.file_io, fixture.analyzer_root);

		expect(identity.analyzer()).toBe(identity.analyzer());
	});

	test("includes new project directories in the directory identity", () => {
		const fixture = new AstDiskCacheFixture("ast-cache-directory-identity");
		const identity = new ProjectAnalysisIdentity(fixture.file_io, fixture.analyzer_root);
		const before = identity.directory_context(fixture.root);
		fixture.file_io.directory_operations.create_directory(fixture.path("src/nested"));

		expect(identity.directory_context(fixture.root)).not.toBe(before);
	});

	test("ignores generated directories in the directory identity", () => {
		const fixture = new AstDiskCacheFixture("ast-cache-ignore-directory-identity");
		const identity = new ProjectAnalysisIdentity(fixture.file_io, fixture.analyzer_root);
		fixture.write("node_modules/package.json", "{}\n");
		const before = identity.directory_context(fixture.root);
		fixture.file_io.directory_operations.create_directory(fixture.path("node_modules/generated"));

		expect(identity.directory_context(fixture.root)).toBe(before);
	});

	test("reuses analyzer identity within one analysis session", () => {
		const fixture = new AstDiskCacheFixture("ast-cache-analyzer-session");
		const identity = new ProjectAnalysisIdentity(fixture.file_io, fixture.analyzer_root);
		const previous = identity.analyzer();
		fixture.write(join(fixture.analyzer_root, "src/rules.ts"), "export const version = 2;\n");

		expect(identity.analyzer()).toBe(previous);
	});

	test("keeps analyzer identity independent from the target project path", () => {
		const fixture = new AstDiskCacheFixture("ast-cache-target-root");
		const identity_for_first_project = new ProjectAnalysisIdentity(fixture.file_io, fixture.analyzer_root);
		const identity_for_second_project = new ProjectAnalysisIdentity(fixture.file_io, fixture.analyzer_root);

		expect(identity_for_second_project.analyzer()).toBe(identity_for_first_project.analyzer());
	});
});
