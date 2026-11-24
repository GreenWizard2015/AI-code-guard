import { describe, expect, test } from "@jest/globals";
import { LintProjectContextStore } from "src/core/project-context/lint_project_context_store";
import { LintRunProjectSourceScope } from "src/core/project-context/lint_run_project_source_scope";
import { ProjectSourceScanner } from "src/core/project-source/project_source_scanner";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import type { LintRunInventory } from "src/project_analysis_types";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

describe("LintRunProjectSourceScope", () => {
	test("restores snapshot capture state after a successful operation", () => {
		const source_io = new InMemoryProjectSourceIO(new Map());
		const context = new LintProjectContextStore(
			[],
			{ source_reads: 0, typescript_parses: 0, python_parses: 0, source_records: 0 },
			source_io,
		);
		const inventory: LintRunInventory = {
			files: [],
			entry_files: [],
			ignored_files: new Set(),
			ignored_directories: new Set(),
			project_files: [],
			markdown_files: [],
		};
		const scanner = new ProjectSourceScanner("/virtual/project", {
			context_state: { available: true, value: context },
			entry_files: inventory.entry_files,
		});
		const scope = new LintRunProjectSourceScope({
			root: "/virtual/project",
			project_files: inventory.project_files,
			context,
			ignored_files: inventory.ignored_files,
			scanner,
			file_io: new InMemoryFileIO(),
			directory_files: { virtual_project: false, files: inventory.files },
			project_rule_snapshots: [],
		});
		const project_scope = scope.project_analysis();

		const capture_states = {
			before: project_scope.snapshot_capture_active(),
			during: project_scope.capture_snapshots_during(() => project_scope.snapshot_capture_active()),
			after: project_scope.snapshot_capture_active(),
		};
		expect(capture_states).toEqual({ before: false, during: true, after: false });
	});

	test("restores snapshot capture state when an operation fails", () => {
		const source_io = new InMemoryProjectSourceIO(new Map());
		const context = new LintProjectContextStore(
			[],
			{ source_reads: 0, typescript_parses: 0, python_parses: 0, source_records: 0 },
			source_io,
		);
		const inventory: LintRunInventory = {
			files: [],
			entry_files: [],
			ignored_files: new Set(),
			ignored_directories: new Set(),
			project_files: [],
			markdown_files: [],
		};
		const scanner = new ProjectSourceScanner("/virtual/project", {
			context_state: { available: true, value: context },
			entry_files: inventory.entry_files,
		});
		const scope = new LintRunProjectSourceScope({
			root: "/virtual/project",
			project_files: inventory.project_files,
			context,
			ignored_files: inventory.ignored_files,
			scanner,
			file_io: new InMemoryFileIO(),
			directory_files: { virtual_project: false, files: inventory.files },
			project_rule_snapshots: [],
		});
		const project_scope = scope.project_analysis();

		expect(() =>
			project_scope.capture_snapshots_during(() => context.source_record("/virtual/project/missing.ts")),
		).toThrow("Lint source is not loaded: /virtual/project/missing.ts");
		expect(project_scope.snapshot_capture_active()).toBe(false);
	});
});
