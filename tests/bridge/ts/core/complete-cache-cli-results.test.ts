import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
import { NODE_ENV_VARIABLE } from "src/core/constants";
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
	const expected_parse_diagnostic = {
		file: "module.ts",
		line: 1,
		message: "typescript parse error: Expression expected.",
		hint: "correct the syntax before applying structural lint rules. Do not: rely on regex recovery for malformed code.",
		rule_id: "parse-error",
		priority: 7,
	};

	test("preserves exact file results between cold and warm executions", async () => {
		const scenario = new CompleteCacheCliFixture();
		const cold_timer = new LintStageTimer();
		const warm_timer = new LintStageTimer();
		let files_match = false;
		try {
			const cold_execution = new ProjectLintExecution(scenario.execution_options(cold_timer));
			const cold = cold_execution.run();
			const warm_execution = new ProjectLintExecution(scenario.execution_options(warm_timer));
			const warm = warm_execution.run();
			files_match = JSON.stringify(cold.files) === JSON.stringify(warm.files);
		} finally {
			await scenario.close();
		}
		expect(files_match).toBe(true);
	});

	test("preserves diagnostic results between cold and warm executions", async () => {
		const scenario = new CompleteCacheCliFixture();
		const cold_timer = new LintStageTimer();
		const warm_timer = new LintStageTimer();
		let diagnostics_match = false;
		try {
			const cold_execution = new ProjectLintExecution(scenario.execution_options(cold_timer));
			const cold = cold_execution.run();
			const warm_execution = new ProjectLintExecution(scenario.execution_options(warm_timer));
			const warm = warm_execution.run();
			diagnostics_match =
				scenario.diagnostic_signatures(cold.violations) === scenario.diagnostic_signatures(warm.violations);
		} finally {
			await scenario.close();
		}
		expect(diagnostics_match).toBe(true);
	});

	test("preserves parse diagnostic fields on cold complete-cache execution", async () => {
		const scenario = new CompleteCacheCliFixture();
		scenario.set_source("export const value = ;\n");
		const timer = new LintStageTimer();
		let cold_diagnostics: ReturnType<CompleteCacheCliFixture["diagnostic_values"]> = [];
		try {
			const cold_execution = new ProjectLintExecution(scenario.execution_options(timer));
			const cold = cold_execution.run();
			const parse_violations = cold.violations.filter((item) => item.rule_id() === expected_parse_diagnostic.rule_id);
			cold_diagnostics = scenario.diagnostic_values(parse_violations);
		} finally {
			await scenario.close();
		}
		expect(cold_diagnostics).toEqual([expected_parse_diagnostic]);
	});

	test("preserves parse diagnostic fields on warm complete-cache execution", async () => {
		const scenario = new CompleteCacheCliFixture();
		scenario.set_source("export const value = ;\n");
		const cold_timer = new LintStageTimer();
		const warm_timer = new LintStageTimer();
		let warm_diagnostics: ReturnType<CompleteCacheCliFixture["diagnostic_values"]> = [];
		try {
			const cold_execution = new ProjectLintExecution(scenario.execution_options(cold_timer));
			cold_execution.run();
			const warm_execution = new ProjectLintExecution(scenario.execution_options(warm_timer));
			const warm = warm_execution.run();
			warm_diagnostics = scenario.diagnostic_values(
				warm.violations.filter((item) => item.rule_id() === expected_parse_diagnostic.rule_id),
			);
		} finally {
			await scenario.close();
		}
		expect(warm_diagnostics).toEqual([expected_parse_diagnostic]);
	});

	test("reads the complete cache and skips warm analysis", async () => {
		const scenario = new CompleteCacheCliFixture();
		const cold_timer = new LintStageTimer();
		const warm_timer = new LintStageTimer();
		let cache_hit_skipped_analysis = false;
		try {
			const cold_execution = new ProjectLintExecution(scenario.execution_options(cold_timer));
			cold_execution.run();
			const warm_execution = new ProjectLintExecution(scenario.execution_options(warm_timer));
			warm_execution.run();
			const warm_durations = warm_timer.durations();
			const warm_stages = warm_durations.map((stage) => stage.name);
			cache_hit_skipped_analysis =
				warm_stages.includes("startup.complete-cache-read") && !warm_stages.includes("startup");
		} finally {
			await scenario.close();
		}
		expect(cache_hit_skipped_analysis).toBe(true);
	});
});
