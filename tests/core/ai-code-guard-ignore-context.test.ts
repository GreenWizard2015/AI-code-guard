import { resolve } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { LintReportMode } from "src/core/types";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { LintStageTimer } from "src/lint_stage_timer";
import type { ViolationContract } from "src/reporting_protocols";
import { AiCodeGuardIgnoreRule } from "src/rules/support/ai_code_guard_ignore_rule";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

describe("AI Code Guard ignore configuration in project context", () => {
	test("reports the state directory when no gitignore excludes it", () => {
		const root = "/virtual/unignored-state-project";
		const source_io = new InMemoryProjectSourceIO(new Map());
		const violations: ViolationContract[] = [];
		const rule = new AiCodeGuardIgnoreRule(source_io);

		rule.append(violations, root);

		expect(violations.map((violation) => violation.rule_id())).toEqual(["ai-code-guard-directory-ignored"]);
	});

	test("retains a root gitignore omitted from the provided source text map", () => {
		const root = "/virtual/ignore-context-project";
		const source_file = resolve(root, "src/entry.ts");
		const gitignore_file = resolve(root, ".gitignore");
		const source_io = new InMemoryProjectSourceIO(
			new Map([
				[source_file, "export const ready = true;"],
				[gitignore_file, ".ai-code-guard\n"],
			]),
		);
		const configuration = new LintRunConfiguration(source_io, new InMemoryFileIO());
		const execution = configuration.lint_report(
			{
				repo_root: root,
				ignored_directories: [],
				stage_timer: new LintStageTimer(),
				inputs: {
					files: [source_file],
					project_files: [source_file],
					ignored_files: [],
					markdown_files: [],
					ignore_files: [gitignore_file],
				},
				source_texts: new Map([[source_file, "export const ready = true;"]]),
				configuration_snapshot_complete: true,
				entry_files: [],
				project_analysis_enabled: false,
			},
			LintReportMode.IN_MEMORY_PROJECT,
		);
		const context_source_io = execution.context.source_io();
		const source_available = context_source_io.source_available(gitignore_file);
		const source_text = context_source_io.source_text(gitignore_file);
		const violations: ViolationContract[] = [];
		const rule = new AiCodeGuardIgnoreRule(context_source_io);
		rule.append(violations, root);

		expect({
			source_available,
			source_text,
			ignored_directory_violation: violations.some(
				(violation) => violation.rule_id() === "ai-code-guard-directory-ignored",
			),
		}).toEqual({
			source_available: true,
			source_text: ".ai-code-guard\n",
			ignored_directory_violation: false,
		});
	});
});
