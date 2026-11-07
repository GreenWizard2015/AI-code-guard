import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
import { NODE_ENV_VARIABLE } from "src/core/constants";
import { UnusedCode } from "src/core/project-source/unused_code";
import { ProjectLintExecution } from "src/core/project_lint_execution";
import { LintStageTimer } from "src/lint_stage_timer";
import { CompleteCacheCliFixture } from "tests/bridge/ts/core/complete-cache-cli-fixture";

beforeEach(() => {
	process.env[NODE_ENV_VARIABLE] = "production";
});

afterEach(() => {
	process.env[NODE_ENV_VARIABLE] = "test";
});

describe("complete cache CLI execution", () => {
	test("preserves exact files and diagnostics between cold and warm executions", async () => {
		const scenario = new CompleteCacheCliFixture();
		const cold_timer = new LintStageTimer();
		const warm_timer = new LintStageTimer();
		let files_match = false;
		let diagnostics_match = false;
		try {
			const cold_execution = new ProjectLintExecution(scenario.execution_options(cold_timer, new UnusedCode()));
			const cold = cold_execution.run();
			const warm_execution = new ProjectLintExecution(scenario.execution_options(warm_timer, new UnusedCode()));
			const warm = warm_execution.run();
			files_match = JSON.stringify(cold.files) === JSON.stringify(warm.files);
			diagnostics_match =
				scenario.diagnostic_signatures(cold.violations) === scenario.diagnostic_signatures(warm.violations);
		} finally {
			await scenario.close();
		}
		expect({ files_match, diagnostics_match }).toEqual({ files_match: true, diagnostics_match: true });
	});

	test("reads the complete cache and skips warm analysis", async () => {
		const scenario = new CompleteCacheCliFixture();
		const cold_timer = new LintStageTimer();
		const warm_timer = new LintStageTimer();
		let cache_hit_skipped_analysis = false;
		try {
			const cold_execution = new ProjectLintExecution(scenario.execution_options(cold_timer, new UnusedCode()));
			cold_execution.run();
			const warm_execution = new ProjectLintExecution(scenario.execution_options(warm_timer, new UnusedCode()));
			warm_execution.run();
			const warm_stages = warm_timer.durations().map((stage) => stage.name);
			cache_hit_skipped_analysis =
				warm_stages.includes("startup.complete-cache-read") && !warm_stages.includes("startup");
		} finally {
			await scenario.close();
		}
		expect(cache_hit_skipped_analysis).toBe(true);
	});
});
