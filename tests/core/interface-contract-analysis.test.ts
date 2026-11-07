import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { CONSTRUCTOR_FILES, MIXED_DEPENDENCY_FILES } from "tests/core/constants/alias_analysis/constants";
import { TestFixture } from "tests/core/test-fixture";

describe("interface and constructor contracts", () => {
	test("keeps method contracts and mixed dependencies valid while rejecting index signatures", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				...MIXED_DEPENDENCY_FILES,
				"method-only.ts": "interface ChatThreadLoader { fetch_threads(pattern: string): Promise<ThreadList>; }",
				"io-type.ts": [
					"type IOContract = {",
					"  directory_entries: DirectoryEntriesContract;",
					"  directory_operations: DirectoryOperationsContract;",
					"  file(path: string): FileResourceContract;",
					"};",
					"interface DirectoryEntriesContract { entries(): string[]; }",
					"interface DirectoryOperationsContract { create(path: string): void; }",
					"interface FileResourceContract { read(): string; }",
					"declare const io: IOContract;",
				].join("\n"),
				"index-signature.ts": "type RuntimeRecord = { [key: string]: string };",
				"options.ts": [
					"type Options = {",
					"  enabled: boolean;",
					"  on_start?: () => void;",
					"  on_complete?: () => void;",
					"  on_failure?: () => void;",
					"  on_error?: () => void;",
					"};",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const interface_shape_violations = violations.filter((item) => item.rule_id() === "typescript-interface-shape");
		expect({
			interface_shape_count: interface_shape_violations.length,
			interface_shape_file_matches: interface_shape_violations.some((item) => item.file().endsWith("io-type.ts")),
			index_signature_count: violations.filter((item) => item.rule_id() === "typescript-index-signature").length,
		}).toEqual({
			interface_shape_count: 1,
			interface_shape_file_matches: true,
			index_signature_count: 1,
		});
	});

	test("limits constructors to setup and validation in both languages", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			CONSTRUCTOR_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(
			violations.filter((item) => item.message() === "keep constructors limited to setup and validation"),
		).toHaveLength(2);
	});
});
