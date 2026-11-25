import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
import { REPORTING_PROJECT_ROOT } from "src/constants";
import { NODE_ENV_VARIABLE } from "src/core/constants";
import { ProjectLintExecution } from "src/core/lint-run/project_lint_execution";
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
		priority: 6,
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
			files_match = JSON.stringify(cold.report.files) === JSON.stringify(warm.report.files);
		} finally {
			await scenario.close();
		}
		expect(files_match).toBe(true);
	});

	test("[local-process] builds the CLI bundle and preserves diagnostics outside the installation", () => {
		const node_options_key = "NODE_OPTIONS";
		const fixture_root = mkdtempSync(join(tmpdir(), "ai-code-guard-bundle-"));
		const cache_record = join(fixture_root, ".ai-code-guard", "cache", "lint-execution", "lint-result.json");
		const source_command = [
			join(REPORTING_PROJECT_ROOT, "node_modules", "tsx", "dist", "cli.mjs"),
			join(REPORTING_PROJECT_ROOT, "src", "core", "cli.ts"),
		];
		const launcher_alias = join(fixture_root, "guard-bin");
		const bundle_command = [launcher_alias];
		const lint_arguments = ["--root", fixture_root, "--policy", "all", "--batch-size", "10000"];
		const child_options = {
			cwd: tmpdir(),
			encoding: "utf8" as const,
			env: { ...process.env, NODE_ENV: "production" },
		};
		const bundle_options = {
			...child_options,
			env: {
				...child_options.env,
				[node_options_key]: [process.env[node_options_key], "--preserve-symlinks-main"].filter(Boolean).join(" "),
			},
		};
		let build_status: number | null = null;
		let source_status: number | null = null;
		let bundle_status: number | null = null;
		let source_cache_exists = false;
		let bundle_cache_exists = false;
		let results_match = false;
		let violation_count = 0;
		let source_result: ReturnType<typeof JSON.parse> | undefined;
		let bundle_result: ReturnType<typeof JSON.parse> | undefined;
		let build_output = "";
		let source_output = "";
		let bundle_output = "";
		try {
			mkdirSync(join(fixture_root, "src"));
			symlinkSync(join(REPORTING_PROJECT_ROOT, "bin", "ai-code-guard.mjs"), launcher_alias);
			writeFileSync(join(fixture_root, "src", "example.ts"), "export const value = ;\n");
			writeFileSync(join(fixture_root, "src", "example.py"), "class First: pass\nclass Second: pass\n");
			const build = spawnSync(process.execPath, [join(REPORTING_PROJECT_ROOT, "scripts", "build-cli.mjs")], {
				cwd: REPORTING_PROJECT_ROOT,
				encoding: "utf8",
			});
			build_status = build.status;
			build_output = `${build.stdout}\n${build.stderr}`;
			const source = spawnSync(process.execPath, [...source_command, ...lint_arguments], child_options);
			source_status = source.status;
			source_output = `${source.stdout}\n${source.stderr}`;
			source_cache_exists = existsSync(cache_record);
			if (source_cache_exists) {
				source_result = JSON.parse(readFileSync(cache_record, "utf8"));
			}
			rmSync(join(fixture_root, ".ai-code-guard", "cache"), { recursive: true, force: true });
			const bundle = spawnSync(process.execPath, [...bundle_command, ...lint_arguments], bundle_options);
			bundle_status = bundle.status;
			bundle_output = `${bundle.stdout}\n${bundle.stderr}`;
			bundle_cache_exists = existsSync(cache_record);
			if (bundle_cache_exists) {
				bundle_result = JSON.parse(readFileSync(cache_record, "utf8"));
			}
			if (source_result !== undefined && bundle_result !== undefined) {
				results_match = JSON.stringify(bundle_result.result) === JSON.stringify(source_result.result);
			}
			if (bundle_result !== undefined) {
				violation_count = bundle_result.result.violations.length;
			}
		} finally {
			rmSync(fixture_root, { recursive: true, force: true });
		}
		expect({
			build_status,
			source_status,
			bundle_status,
			build_output,
			source_output,
			bundle_output,
			source_cache_exists,
			bundle_cache_exists,
			results_match,
			has_violations: violation_count > 0,
		}).toMatchObject({
			build_status: 0,
			source_status: 1,
			bundle_status: 1,
			source_cache_exists: true,
			bundle_cache_exists: true,
			results_match: true,
			has_violations: true,
		});
	}, 30000);

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
				scenario.diagnostic_signatures(cold.report.violations) ===
				scenario.diagnostic_signatures(warm.report.violations);
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
			const parse_violations = cold.report.violations.filter(
				(item) => item.rule_id() === expected_parse_diagnostic.rule_id,
			);
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
				warm.report.violations.filter((item) => item.rule_id() === expected_parse_diagnostic.rule_id),
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

	test("reuses complete analysis for agent reports", async () => {
		const scenario = new CompleteCacheCliFixture();
		const cold_timer = new LintStageTimer();
		const agent_timer = new LintStageTimer();
		let result = { cache_hit: false, links_match: false };
		try {
			const cold_execution = new ProjectLintExecution(scenario.execution_options(cold_timer));
			const cold = cold_execution.run();
			const agent_execution = new ProjectLintExecution(scenario.execution_options(agent_timer, true));
			const agent = agent_execution.run();
			const warm_stages = agent_timer.durations().map((stage) => stage.name);
			result = {
				cache_hit: warm_stages.includes("startup.complete-cache-read") && !warm_stages.includes("startup"),
				links_match: JSON.stringify(agent.test_target_links) === JSON.stringify(cold.test_target_links),
			};
		} finally {
			await scenario.close();
		}
		expect(result).toEqual({ cache_hit: true, links_match: true });
	});
});
