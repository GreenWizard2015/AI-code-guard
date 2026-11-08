import { constants } from "node:os";
import { describe, expect, test } from "@jest/globals";
import { ReviewAgentProcess } from "src/core/support/task/review-agent/process/review_agent_process";
import { ReviewAgentProcessIdentityFixture } from "tests/core/support/task/review-agent/process/review_agent_process_identity_fixture";

describe("review agent process identity", () => {
	test("persists child identity through the supplied filesystem", () => {
		const fixture = new ReviewAgentProcessIdentityFixture(4321, 4322, "/virtual/review-process-io");
		fixture.seed_process_identity();
		const dependencies = fixture.process_dependencies(process.platform);
		const agent = new ReviewAgentProcess(
			dependencies.file_io,
			dependencies.spawner,
			dependencies.platform,
			dependencies.process_signal,
		);
		const failure = agent.persist(fixture.process_execution("test-token"));

		expect({
			failure,
			persisted: fixture.identity_file_exists(),
			ownership_token: fixture.persisted_token().includes("test-token"),
		}).toEqual({ failure: "", persisted: true, ownership_token: true });
	});

	test("persists the spawned process ownership token", async () => {
		const fixture = new ReviewAgentProcessIdentityFixture();
		fixture.seed_owned_process();
		const dependencies = fixture.process_dependencies("linux");
		const agent = new ReviewAgentProcess(
			dependencies.file_io,
			dependencies.spawner,
			dependencies.platform,
			dependencies.process_signal,
		);
		const result = agent.run_async({ command: "codex", arguments_list: [], root: "/virtual/review-process-token" });
		const spawned_token = fixture.spawned_token();
		const persisted_token = fixture.persisted_token();
		fixture.seed_descendant_token(spawned_token);
		fixture.finish_child();
		const completed = await result;

		expect({ spawned_token, persisted_token, exit_code: completed.exit_code }).toEqual({
			spawned_token: expect.any(String),
			persisted_token: spawned_token,
			exit_code: 0,
		});
	});

	test("cleans a live descendant with the persisted ownership token", async () => {
		const pid = 4321;
		const fixture = new ReviewAgentProcessIdentityFixture(pid);
		fixture.seed_owned_process();
		const { file_io, spawner, platform, process_signal } = fixture.process_dependencies("linux");
		const agent = new ReviewAgentProcess(file_io, spawner, platform, process_signal);
		const completion = agent.run_async({ command: "codex", arguments_list: [], root: "/virtual/review-process-token" });
		fixture.seed_descendant_token(fixture.spawned_token());
		fixture.finish_child();
		await completion;

		expect({
			signals: fixture.termination_signals(),
			identity_removed: fixture.identity_removed(),
			process_group_live: fixture.process_group_live(),
		}).toEqual({
			signals: [-pid, constants.signals.SIGTERM, -pid, constants.signals.SIGKILL],
			identity_removed: true,
			process_group_live: false,
		});
	});
});
