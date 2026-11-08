import { join } from "node:path";
import type { CliApplication } from "src/core/cli_application";
import { NODE_ENV_VARIABLE } from "src/core/constants";
import type { LintRunConfiguration } from "src/core/lint_run_configuration";
import type { TaskReviewMemoryWorkspace } from "tests/bridge/ts/core/task-review-memory-workspace";
import type { WarmCliCacheResult } from "tests/bridge/ts/core/types";

/** Responsibilities: _cache result comparison_, _CLI cache state transitions_. **/
export class TaskReviewCacheScenario {
	/** Responsibilities: _review failure status_. **/
	private exit_failed(lint_failed: boolean, review_failed: boolean): boolean {
		if (lint_failed) {
			return true;
		}
		return review_failed;
	}

	/** Responsibilities: _cached global diagnostic values_. **/
	private unused_class_diagnostics(configuration: LintRunConfiguration, fixture: TaskReviewMemoryWorkspace): string[] {
		const inputs = configuration.input_files(fixture._root, []);
		return configuration
			.lint_report({
				repo_root: fixture._root,
				ignored_directories: [],
				stage_timer: fixture.stage_timer(),
				inputs,
				source_texts: fixture._source_texts,
				configuration_snapshot_complete: false,
				entry_files: [],
				project_analysis_enabled: false,
			})
			.report.violations.filter((item) => item.rule_id() === "unused-class")
			.map((item) =>
				JSON.stringify({
					file: item.file(),
					line: item.line(),
					message: item.message(),
					hint: item.hint(),
					rule_id: item.rule_id(),
					priority: item.priority(),
				}),
			);
	}

	/** Responsibilities: _process environment restoration_. **/
	private restore_environment(was_set: boolean, previous: string): void {
		if (was_set) {
			process.env[NODE_ENV_VARIABLE] = previous;
			return;
		}
		delete process.env[NODE_ENV_VARIABLE];
	}

	/** Responsibilities: _complete-cache CLI regression_. **/
	public async warm_cli_cache(cli: CliApplication, fixture: TaskReviewMemoryWorkspace): Promise<WarmCliCacheResult> {
		const environment_was_set = process.env[NODE_ENV_VARIABLE] !== undefined;
		let previous_node_environment = "";
		if (process.env[NODE_ENV_VARIABLE] !== undefined) {
			previous_node_environment = process.env[NODE_ENV_VARIABLE];
		}
		process.env[NODE_ENV_VARIABLE] = "production";
		const options = fixture.cli_options(true, false, "none");
		let result: WarmCliCacheResult = {
			cold_exit_is_failure: false,
			warm_exit_is_failure: false,
			same_report: false,
			cache_exists: false,
		};
		try {
			const cold_status = await cli.run_project(options, fixture.stage_timer());
			const cold = {
				failed: this.exit_failed(cold_status.lint_failed, cold_status.review_failed),
				report: fixture.report(),
			};
			const warm_status = await cli.run_project(options, fixture.stage_timer());
			const warm = {
				failed: this.exit_failed(warm_status.lint_failed, warm_status.review_failed),
				report: fixture.report(),
			};
			const cache = join(fixture._root, ".ai-code-guard", "cache", "lint-execution", "lint-result.json");
			result = {
				cold_exit_is_failure: cold.failed,
				warm_exit_is_failure: warm.failed,
				same_report: cold.report === warm.report,
				cache_exists: fixture._io.file(cache).path_exists(),
			};
		} finally {
			this.restore_environment(environment_was_set, previous_node_environment);
		}
		return result;
	}

	/** Responsibilities: _warm global diagnostic cache_. **/
	public warm_unused_class_diagnostics(
		configuration: LintRunConfiguration,
		fixture: TaskReviewMemoryWorkspace,
	): { first: string[]; second: string[] } {
		const environment_was_set = process.env[NODE_ENV_VARIABLE] !== undefined;
		let previous_node_environment = "";
		if (process.env[NODE_ENV_VARIABLE] !== undefined) {
			previous_node_environment = process.env[NODE_ENV_VARIABLE];
		}
		process.env[NODE_ENV_VARIABLE] = "production";
		try {
			return {
				first: this.unused_class_diagnostics(configuration, fixture),
				second: this.unused_class_diagnostics(configuration, fixture),
			};
		} finally {
			configuration.close_worker_session();
			this.restore_environment(environment_was_set, previous_node_environment);
		}
	}

	/** Responsibilities: _global diagnostic cache invalidation_. **/
	public invalidated_unused_class_diagnostics(
		configuration: LintRunConfiguration,
		fixture: TaskReviewMemoryWorkspace,
	): { initial: number; changed: number } {
		const environment_was_set = process.env[NODE_ENV_VARIABLE] !== undefined;
		let previous_node_environment = "";
		if (process.env[NODE_ENV_VARIABLE] !== undefined) {
			previous_node_environment = process.env[NODE_ENV_VARIABLE];
		}
		process.env[NODE_ENV_VARIABLE] = "production";
		try {
			const initial = this.unused_class_diagnostics(configuration, fixture).length;
			const file = join(fixture._root, "source.ts");
			const edited = "export class UsedClass {}\nexport const value = new UsedClass();\n";
			fixture._io.file(file).write_text(edited);
			fixture._source_texts.set(file, edited);
			return { initial, changed: this.unused_class_diagnostics(configuration, fixture).length };
		} finally {
			configuration.close_worker_session();
			this.restore_environment(environment_was_set, previous_node_environment);
		}
	}
}
