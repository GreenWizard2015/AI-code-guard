import { jest } from "@jest/globals";
import { TaskReporting } from "src/core/support/task_reporting";
import { LintStageTimer } from "src/lint_stage_timer";
import type { CliOptions } from "src/types";
import { TaskReviewMemoryFixture } from "tests/bridge/ts/core/task-review-memory-fixture";

/** Responsibilities: _review state_, _provider responses_. **/
export class ForcedReviewScenario {
	/** Responsibilities: _forced review options_. **/
	private options(root: string): CliOptions {
		return {
			root,
			ignored_directories: [],
			entry_files: [],
			skip_review: true,
			force_review: true,
			review_cleanup: false,
			review_agent: "codex",
			review_stages: [],
			batch_size: 10,
			policy: "all",
		};
	}

	/** Responsibilities: _forced review production boundary_. **/
	public async run(): Promise<void> {
		const fixture_factory = new TaskReviewMemoryFixture();
		const fixture = fixture_factory.create("const value: string = 1;\n");
		await fixture.cli().run_project(this.options(fixture.root), new LintStageTimer());
	}

	/** Responsibilities: _forced review result_. **/
	public async forced_review_capture(): Promise<{ provider: string; forced: boolean }> {
		const previous_exit_code = process.exitCode;
		process.exitCode = 0;
		const run_review_agent = jest
			.spyOn(TaskReporting.prototype, "run_review_agent")
			.mockResolvedValue({ provider: "codex", message: "mocked review" });
		let result = { provider: "", forced: false };
		try {
			await this.run();
			const call = run_review_agent.mock.lastCall;
			if (call !== undefined) {
				result = { provider: call[0], forced: call[1].force_review };
			}
		} finally {
			run_review_agent.mockRestore();
			process.exitCode = previous_exit_code;
		}
		return result;
	}
}
