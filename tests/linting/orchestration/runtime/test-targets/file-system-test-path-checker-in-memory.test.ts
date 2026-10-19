import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { describe, expect, test } from "@jest/globals";
import { FileSystemTestPathChecker } from "src/linting/orchestration/runtime/test-targets/file_system_test_path_checker";
import { TestFileOrganization } from "src/linting/orchestration/runtime/test-targets/test_file_organization";

describe("in-memory test path snapshots", () => {
	test("recognizes source files, their directories, and a matching test layout", () => {
		const root = "/virtual/project";
		const checker = new FileSystemTestPathChecker(root, ["src/domain/status.ts"]);
		const organization = new TestFileOrganization(root, checker);

		expect({
			source_file: checker.file("src/domain/status.ts"),
			source_directory: checker.directory("src/domain"),
			valid_test_layout: organization.valid("tests/domain/status.test.ts"),
		}).toEqual({ source_file: true, source_directory: true, valid_test_layout: true });
	});

	test("does not infer files or directories absent from the snapshot", () => {
		const checker = new FileSystemTestPathChecker("/virtual/project", ["src/domain/status.ts"]);

		expect({
			other_file: checker.file("src/domain/reader.ts"),
			unrelated_directory: checker.directory("src/payments"),
		}).toEqual({ other_file: false, unrelated_directory: false });
	});

	test("matches source ancestors without accepting path-prefix collisions", () => {
		const checker = new FileSystemTestPathChecker("/virtual/project", [
			"src/domain/status.ts",
			"src/domain/nested/reader.ts",
			"src/domainish/other.ts",
		]);

		expect({
			project_source_root: checker.directory("src"),
			source_directory: checker.directory("src/domain"),
			nested_source_directory: checker.directory("src/domain/nested"),
			prefix_collision: checker.directory("src/dom"),
			file_is_not_directory: checker.directory("src/domain/status.ts"),
			filesystem_root: checker.directory("/"),
		}).toEqual({
			project_source_root: true,
			source_directory: true,
			nested_source_directory: true,
			prefix_collision: false,
			file_is_not_directory: false,
			filesystem_root: false,
		});
	});

	test("does not accept a layout from disk when it is absent from the source snapshot", () => {
		const root = process.cwd();
		const checker = new FileSystemTestPathChecker(root, ["src/domain/status.ts"]);
		const organization = new TestFileOrganization(root, checker);

		expect(organization.valid("tests/performance/status.test.ts")).toBe(false);
	});
});
