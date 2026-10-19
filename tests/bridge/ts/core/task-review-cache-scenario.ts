import { join } from "node:path";
import { CliApplication } from "src/core/cli_application";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { TaskReviewMemoryWorkspace } from "tests/bridge/ts/core/task-review-memory-workspace";
import type { WarmCliCacheResultContract } from "tests/bridge/ts/core/types";

/** Responsibilities: _cache result comparison_, _CLI cache state transitions_. **/
export class TaskReviewCacheScenario {
	/** Responsibilities: _cached global diagnostic values_. **/
	private unused_class_diagnostics(configuration: LintRunConfiguration, fixture: TaskReviewMemoryWorkspace): string[] {
		const inputs = configuration.input_files(fixture.root, []);
		return configuration
			.lint_report({
				repo_root: fixture.root,
				ignored_directories: [],
				stage_timer: fixture.stage_timer(),
				inputs,
				source_texts: fixture.source_texts,
				entry_files: [],
			})
			.report.violations.filter((item) => item.rule_id === "unused-class")
			.map((item) => JSON.stringify(item.details()));
	}

	/** Responsibilities: _process environment restoration_. **/
	private restore_environment(was_set: boolean, previous: string): void {
		if (was_set) {
			process.env.NODE_ENV = previous;
			return;
		}
		delete process.env.NODE_ENV;
	}

	/** Responsibilities: _complete-cache CLI regression_. **/
	public async warm_cli_cache(
		cli: CliApplication,
		fixture: TaskReviewMemoryWorkspace,
	): Promise<WarmCliCacheResultContract> {
		const exit_code_was_set = process.exitCode !== undefined;
		let previous_exit_code = 0;
		if (process.exitCode !== undefined) {
			previous_exit_code = Number(process.exitCode);
		}
		const environment_was_set = process.env.NODE_ENV !== undefined;
		let previous_node_environment = "";
		if (process.env.NODE_ENV !== undefined) {
			previous_node_environment = process.env.NODE_ENV;
		}
		process.env.NODE_ENV = "production";
		const options = fixture.cli_options(true, false, "none");
		let result: WarmCliCacheResultContract = {
			cold_exit_is_failure: false,
			warm_exit_is_failure: false,
			same_report: false,
			cache_exists: false,
		};
		try {
			process.exitCode = 0;
			await cli.run_project(options, fixture.stage_timer());
			const cold = { failed: process.exitCode === 1, report: fixture.report() };
			process.exitCode = 0;
			await cli.run_project(options, fixture.stage_timer());
			const warm = { failed: process.exitCode === 1, report: fixture.report() };
			const cache = join(fixture.root, ".ai-code-guard", "cache", "lint-execution", "lint-result.json");
			result = {
				cold_exit_is_failure: cold.failed,
				warm_exit_is_failure: warm.failed,
				same_report: cold.report === warm.report,
				cache_exists: fixture.io.file_paths.path_exists(cache),
			};
		} finally {
			if (exit_code_was_set) {
				process.exitCode = previous_exit_code;
			} else {
				delete process.exitCode;
			}
			this.restore_environment(environment_was_set, previous_node_environment);
		}
		return result;
	}

	/** Responsibilities: _warm global diagnostic cache_. **/
	public warm_unused_class_diagnostics(
		configuration: LintRunConfiguration,
		fixture: TaskReviewMemoryWorkspace,
	): { first: string[]; second: string[] } {
		const environment_was_set = process.env.NODE_ENV !== undefined;
		let previous_node_environment = "";
		if (process.env.NODE_ENV !== undefined) {
			previous_node_environment = process.env.NODE_ENV;
		}
		process.env.NODE_ENV = "production";
		try {
			return {
				first: this.unused_class_diagnostics(configuration, fixture),
				second: this.unused_class_diagnostics(configuration, fixture),
			};
		} finally {
			void configuration.python_ast_worker.close();
			this.restore_environment(environment_was_set, previous_node_environment);
		}
	}

	/** Responsibilities: _global diagnostic cache invalidation_. **/
	public invalidated_unused_class_diagnostics(
		configuration: LintRunConfiguration,
		fixture: TaskReviewMemoryWorkspace,
	): { initial: number; changed: number } {
		const environment_was_set = process.env.NODE_ENV !== undefined;
		let previous_node_environment = "";
		if (process.env.NODE_ENV !== undefined) {
			previous_node_environment = process.env.NODE_ENV;
		}
		process.env.NODE_ENV = "production";
		try {
			const initial = this.unused_class_diagnostics(configuration, fixture).length;
			const file = join(fixture.root, "source.ts");
			const edited = "export class UsedClass {}\nexport const value = new UsedClass();\n";
			fixture.io.file_content.write_text(file, edited);
			fixture.source_texts.set(file, edited);
			return { initial, changed: this.unused_class_diagnostics(configuration, fixture).length };
		} finally {
			void configuration.python_ast_worker.close();
			this.restore_environment(environment_was_set, previous_node_environment);
		}
	}
}
