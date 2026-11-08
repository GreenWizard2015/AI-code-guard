import "src/core/lint_project_context_creator";
import { PassThrough } from "node:stream";
import { describe, expect, test } from "@jest/globals";
import { QualityCheckDefinitions } from "test-runner/quality_check_definitions";
import { QualityCheckProcess } from "test-runner/quality_check_process";
import { TestExecution } from "test-runner/test_execution";
import { CommandExecutionTestDouble } from "tests/core/command_execution_test_double";
import { PROJECT_ROOT } from "tests/core/constants";

describe("quality check execution", () => {
	const project_lint_command = ["pnpm", "--dir", PROJECT_ROOT, "lint"];
	const quality_check_definitions = new QualityCheckDefinitions(PROJECT_ROOT);
	const quality_checks_list = quality_check_definitions.all_checks();

	test("skips quality commands for a skipped test-runner request", () => {
		const runner = new CommandExecutionTestDouble([]);
		const quality_checks = new QualityCheckProcess(PROJECT_ROOT, runner, {
			stdout: new PassThrough(),
			stderr: new PassThrough(),
		});
		const status = quality_checks.run_test_request({
			args: [],
			help_requested: false,
			headless: true,
			skip_quality: true,
			force_review: false,
			review_agent: "none",
		});

		expect({ status, calls: runner.snapshot().calls }).toEqual({ status: 0, calls: [] });
	});

	test("returns the failed quality command status", () => {
		const runner = new CommandExecutionTestDouble([3, 0]);
		const quality_checks = new QualityCheckProcess(PROJECT_ROOT, runner, {
			stdout: new PassThrough(),
			stderr: new PassThrough(),
		});
		const status = quality_checks.run({ force_review: false, review_agent: "none" });
		const snapshot = runner.snapshot();

		expect({ status, call_count: snapshot.calls.length }).toEqual({
			status: 3,
			call_count: 1,
		});
	});

	test.each(quality_checks_list.map((check, failed_index) => ({ failed_index, label: check.label })))(
		"stops at quality stage $failed_index: $label",
		({ failed_index }) => {
			const statuses = Array.from({ length: 10 }, () => 0);
			statuses[failed_index] = 3;
			const runner = new CommandExecutionTestDouble(statuses);
			const quality_checks = new QualityCheckProcess(PROJECT_ROOT, runner, {
				stdout: new PassThrough(),
				stderr: new PassThrough(),
			});
			const status = quality_checks.run({ force_review: false, review_agent: "none" });

			const expected_checks = quality_checks_list.slice(0, failed_index + 1);
			const expected_calls = expected_checks.map((check) => [check.command, ...check.args]);
			expect({ status, calls: runner.snapshot().calls }).toEqual({
				status: 3,
				calls: expected_calls,
			});
		},
	);

	test("runs rule documentation validation immediately after coding lint", () => {
		const runner = new CommandExecutionTestDouble(Array.from({ length: 20 }, () => 0));
		const quality_checks = new QualityCheckProcess(PROJECT_ROOT, runner, {
			stdout: new PassThrough(),
			stderr: new PassThrough(),
		});
		const status = quality_checks.run({ force_review: false, review_agent: "none" });
		const snapshot = runner.snapshot();
		const expected_calls = quality_checks_list.map((check) => [check.command, ...check.args]);
		const lint_index = snapshot.calls.findIndex(
			(call) => call.slice(0, project_lint_command.length).join(" ") === project_lint_command.join(" "),
		);
		const documentation_index = snapshot.calls.findIndex((call) => call.includes("validate:rule-docs"));

		expect({
			status,
			calls: snapshot.calls,
			documentation_follows_lint: documentation_index === lint_index + 1,
			documentation_command: snapshot.calls[documentation_index],
		}).toEqual({
			status: 0,
			calls: expected_calls,
			documentation_follows_lint: true,
			documentation_command: ["pnpm", "--dir", PROJECT_ROOT, "validate:rule-docs"],
		});
	});

	test("passes force-review and agent options only when a review agent is selected", () => {
		const runner = new CommandExecutionTestDouble(Array.from({ length: 20 }, () => 0));
		const quality_checks = new QualityCheckProcess(PROJECT_ROOT, runner, {
			stdout: new PassThrough(),
			stderr: new PassThrough(),
		});
		const status = quality_checks.run({ force_review: true, review_agent: "codex" });
		const lint_call = runner
			.snapshot()
			.calls.find((call) => call.slice(0, project_lint_command.length).join(" ") === project_lint_command.join(" "));

		let force_requested = false;
		let selected_agent = "none";
		if (lint_call !== undefined) {
			force_requested = lint_call.includes("--force-review");
			const agent_option_index = lint_call.indexOf("--review-agent");
			if (agent_option_index >= 0) {
				const agent_value = lint_call[agent_option_index + 1];
				if (agent_value !== undefined) {
					selected_agent = agent_value;
				}
			}
		}

		expect({ status, force_requested, selected_agent }).toEqual({
			status: 0,
			force_requested: true,
			selected_agent: "codex",
		});
	});

	test("does not add review flags when no review agent is selected", () => {
		const runner = new CommandExecutionTestDouble(Array.from({ length: 20 }, () => 0));
		const quality_checks = new QualityCheckProcess(PROJECT_ROOT, runner, {
			stdout: new PassThrough(),
			stderr: new PassThrough(),
		});
		const status = quality_checks.run({ force_review: false, review_agent: "none" });
		const lint_call = runner
			.snapshot()
			.calls.find((call) => call.slice(0, project_lint_command.length).join(" ") === project_lint_command.join(" "));
		const expected_lint_call = ["pnpm", "--dir", PROJECT_ROOT, "lint", "--", "--ignore-dir", ".codex"];
		expect(status).toBe(0);
		expect(lint_call).toEqual(expected_lint_call);
	});

	test("skips review in headless mode unless a review agent is selected", () => {
		const runner = new CommandExecutionTestDouble(Array.from({ length: 20 }, () => 0));
		const execution = new TestExecution(PROJECT_ROOT, runner, { stdout: new PassThrough(), stderr: new PassThrough() });
		execution.run_args(["--headless", "--force-review"]);
		const lint_call = runner
			.snapshot()
			.calls.find((call) => call.slice(0, project_lint_command.length).join(" ") === project_lint_command.join(" "));
		let has_agent = false;
		let has_force = false;
		let has_skip = false;
		if (lint_call !== undefined) {
			has_agent = lint_call.includes("--review-agent");
			has_force = lint_call.includes("--force-review");
			has_skip = lint_call.includes("--skip-review");
		}

		expect({
			has_agent,
			has_force,
			has_skip,
		}).toEqual({ has_agent: false, has_force: false, has_skip: false });
	});

	test("preserves an explicitly selected review provider", () => {
		const runner = new CommandExecutionTestDouble(Array.from({ length: 20 }, () => 0));
		const execution = new TestExecution(PROJECT_ROOT, runner, { stdout: new PassThrough(), stderr: new PassThrough() });
		execution.run_args(["--headless", "--force-review", "--review-agent", "claude"]);
		const lint_call = runner
			.snapshot()
			.calls.find((call) => call.slice(0, project_lint_command.length).join(" ") === project_lint_command.join(" "));
		let selected_agent: string | undefined;
		if (lint_call !== undefined) {
			const agent_index = lint_call.indexOf("--review-agent");
			if (agent_index >= 0) {
				selected_agent = lint_call[agent_index + 1];
			}
		}

		expect({
			has_claude: selected_agent === "claude",
			has_codex: selected_agent === "codex",
		}).toEqual({ has_claude: true, has_codex: false });
	});
});
