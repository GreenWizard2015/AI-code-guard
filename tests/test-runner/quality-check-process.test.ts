import "src/core/lint_project_context_creator";
import { describe, expect, test } from "@jest/globals";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { QualityCheckProcess } from "test-runner/quality_check_process";
import { TestExecution } from "test-runner/test_execution";
import { CommandExecutionTestDouble } from "tests/core/command_execution_test_double";
import { PROJECT_ROOT } from "tests/core/constants";

describe("quality check execution", () => {
	test("stops quality checks after a failed command", () => {
		const runner = new CommandExecutionTestDouble([3, 0]);
		const quality_checks = new QualityCheckProcess(PROJECT_ROOT, runner, runner);
		quality_checks.run({ force_review: false, review_cleanup: false, review_agent: "none" });

		expect({ observed_exit_code: runner.exit_status, calls: runner.calls }).toEqual({
			observed_exit_code: 3,
			calls: [runner.calls[0]],
		});
	});

	test.each([
		[0, "TypeScript formatting"],
		[1, "TypeScript types and unused declarations"],
		[2, "Python formatting"],
		[3, "Ruff Python linting"],
		[4, "Python unused imports and names"],
		[5, "Python type checking"],
		[6, "Python unused functions and classes"],
		[7, "Coding lint"],
		[8, "Rule documentation validation"],
	])("stops at each later quality stage", (failed_index) => {
		const statuses = Array.from({ length: 9 }, () => 0);
		statuses[failed_index] = 3;
		const runner = new CommandExecutionTestDouble(statuses);
		const quality_checks = new QualityCheckProcess(PROJECT_ROOT, runner, runner);
		quality_checks.run({ force_review: false, review_cleanup: false, review_agent: "none" });

		expect({ observed_exit_code: runner.exit_status, call_count: runner.calls.length }).toEqual({
			observed_exit_code: 3,
			call_count: failed_index + 1,
		});
	});

	test("runs rule documentation validation immediately after coding lint", () => {
		const runner = new CommandExecutionTestDouble(Array.from({ length: 20 }, () => 0));
		const quality_checks = new QualityCheckProcess(PROJECT_ROOT, runner, runner);
		quality_checks.run({ force_review: false, review_cleanup: false, review_agent: "none" });
		const lint_index = runner.calls.findIndex((call) => call.includes("lint"));
		const documentation_index = runner.calls.findIndex((call) => call.includes("validate:rule-docs"));

		expect({
			documentation_follows_lint: documentation_index === lint_index + 1,
			documentation_command: runner.calls[documentation_index],
		}).toEqual({
			documentation_follows_lint: true,
			documentation_command: ["pnpm", "--dir", PROJECT_ROOT, "validate:rule-docs"],
		});
	});

	test("passes review options only when a review agent is selected", () => {
		const runner = new CommandExecutionTestDouble(Array.from({ length: 20 }, () => 0));
		const quality_checks = new QualityCheckProcess(PROJECT_ROOT, runner, runner);
		quality_checks.run({ force_review: false, review_cleanup: true, review_agent: "codex" });
		const lint_call = runner.calls.find((call) => call.includes("lint"));

		expect(lint_call).toContain("--review-cleanup");
		expect(lint_call).toEqual(expect.arrayContaining(["--review-agent", "codex"]));
	});

	test("does not add review flags when no review agent is selected", () => {
		const runner = new CommandExecutionTestDouble(Array.from({ length: 20 }, () => 0));
		const quality_checks = new QualityCheckProcess(PROJECT_ROOT, runner, runner);
		quality_checks.run({ force_review: false, review_cleanup: false, review_agent: "none" });
		const lint_call = runner.calls.find((call) => call.includes("lint"));
		const expected_lint_call = ["pnpm", "--dir", PROJECT_ROOT, "lint"];
		const external_directory = join(PROJECT_ROOT, "external");
		if (existsSync(external_directory)) {
			expected_lint_call.push("--ignore-dir", external_directory);
		}
		expect(lint_call).toEqual(expected_lint_call);
	});

	test("skips review in headless mode unless a review agent is selected", () => {
		const runner = new CommandExecutionTestDouble(Array.from({ length: 20 }, () => 0));
		const execution = new TestExecution(PROJECT_ROOT, runner);
		execution.run_args(["--headless", "--force-review"]);
		const lint_call = runner.calls.find((call) => call.includes("lint"));

		expect({
			has_agent: lint_call?.includes("--review-agent") === true,
			has_force: lint_call?.includes("--force-review") === true,
			has_skip: lint_call?.includes("--skip-review") === true,
		}).toEqual({ has_agent: false, has_force: false, has_skip: false });
	});

	test("preserves an explicitly selected review provider", () => {
		const runner = new CommandExecutionTestDouble(Array.from({ length: 20 }, () => 0));
		const execution = new TestExecution(PROJECT_ROOT, runner);
		execution.run_args(["--headless", "--force-review", "--review-agent", "claude"]);
		const lint_call = runner.calls.find((call) => call.includes("lint"));
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
