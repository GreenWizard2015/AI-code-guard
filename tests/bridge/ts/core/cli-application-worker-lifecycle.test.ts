import { describe, expect, test } from "@jest/globals";
import { CliApplication } from "src/core/cli_application";
import { ArchitectureReviewFailureTimer } from "tests/bridge/ts/core/architecture_review_failure_timer";
import { CliWorkerLifecycleScenario } from "tests/bridge/ts/core/cli-worker-lifecycle-scenario";
import { TaskReviewMemoryFixture } from "tests/bridge/ts/core/task-review-memory-fixture";

describe("CLI application Python worker lifecycle", () => {
	test("releases the worker lease before a failed run settles", async () => {
		const scenario = new CliWorkerLifecycleScenario();
		const fixture = new TaskReviewMemoryFixture();
		const workspace = fixture.create("def read_value() -> int:\n    return 1\n", "source.py");
		const application = new CliApplication(workspace._io, workspace._source_io);
		const worker_captured = scenario.capture_worker();
		const timer = new ArchitectureReviewFailureTimer("architecture review failure");
		const run_error_message = await application.run_project(workspace.cli_options(true, true, "codex"), timer).then(
			() => "",
			(reason: unknown) => String(reason),
		);
		const worker_exited = await scenario.close();
		const registry_entry_released = scenario.registry_entry_released();

		expect({
			worker_captured,
			run_error_message,
			registry_entry_released,
			worker_exited,
		}).toEqual({
			worker_captured: true,
			run_error_message: "Error: architecture review failure",
			registry_entry_released: true,
			worker_exited: true,
		});
	});

	test("releases the worker lease when run_project completes", async () => {
		const scenario = new CliWorkerLifecycleScenario();
		const fixture = new TaskReviewMemoryFixture();
		const source = ["def read_value():", "    try:", "        return 1", "    except:", "        return 0"].join("\n");
		const workspace = fixture.create(source, "source.py");
		const application = new CliApplication(workspace._io, workspace._source_io);
		const observation = await scenario.run_project(application, workspace);

		expect({
			worker_captured: observation.worker_captured,
			report_has_issues: scenario.reports_contain_issues(observation.run),
			lease_count: observation.run.lease_count,
			registry_entry_released: observation.run.registry_entry_released,
			worker_exited: observation.worker_exited,
		}).toEqual({
			worker_captured: true,
			report_has_issues: true,
			lease_count: 0,
			registry_entry_released: true,
			worker_exited: true,
		});
	});

	test("reuses one application for changed Python input without leaving worker leases", async () => {
		const scenario = new CliWorkerLifecycleScenario();
		const fixture = new TaskReviewMemoryFixture();
		const source = ["def read_value():", "    try:", "        return 1", "    except:", "        return 0"].join("\n");
		const workspace = fixture.create(source, "source.py");
		const application = new CliApplication(workspace._io, workspace._source_io);
		const observation = await scenario.run_changed_input(application, workspace);

		expect({
			worker_captured: observation.worker_captured,
			first_run_has_issues: scenario.reports_contain_issues(observation.first_run),
			second_run_has_issues: scenario.reports_contain_issues(observation.second_run),
			reports_match: scenario.reports_match(observation),
			first_run_released_lease: observation.first_run.registry_entry_released,
			second_run_released_lease: observation.second_run.registry_entry_released,
			first_lease_count: observation.first_run.lease_count,
			second_lease_count: observation.second_run.lease_count,
			worker_exited: observation.worker_exited,
			reports: [observation.first_run.documents, observation.second_run.documents],
		}).toEqual({
			worker_captured: true,
			first_run_has_issues: true,
			second_run_has_issues: true,
			reports_match: false,
			first_run_released_lease: true,
			second_run_released_lease: true,
			first_lease_count: 0,
			second_lease_count: 0,
			worker_exited: true,
			reports: [
				expect.objectContaining({ lint_output: expect.stringContaining("Total issues: 9.") }),
				expect.objectContaining({ lint_output: expect.stringContaining("Total issues: 8.") }),
			],
		});
	});
});
