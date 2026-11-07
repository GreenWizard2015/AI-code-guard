import "src/core/lint_project_context_creator";
import { Readable } from "node:stream";
import { describe, expect, test } from "@jest/globals";
import {
	AI_CODE_GUARD_DIRECTORY,
	REVIEW_AGENT_DIRECTORY,
	REVIEW_AGENT_GROUP_TOKEN_VARIABLE,
	REVIEW_DIRECTORY,
	REVIEW_RUN_LOCK_DIRECTORY,
} from "src/core/support/task/review-agent/constants";
import { NodeProcessSignal } from "src/core/support/task/review-agent/process/node_process_signal";
import { ReviewAgentProcess } from "src/core/support/task/review-agent/process/review_agent_process";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { ReviewAgentChildProcess } from "tests/bridge/ts/core/review-agent/review-agent-child-process";
import { ReviewAgentProcessTestDriver } from "tests/bridge/ts/core/review-agent/review-agent-process-test-driver";

describe("review agent process identity", () => {
	test("persists child identity through the supplied filesystem", () => {
		const pid = 4321;
		const root = "/virtual/review-process-io";
		const identity_file = `${root}/${AI_CODE_GUARD_DIRECTORY}/${REVIEW_DIRECTORY}/${REVIEW_RUN_LOCK_DIRECTORY}/${REVIEW_AGENT_DIRECTORY}/${pid}`;
		const file_io = new InMemoryFileIO();
		file_io.seed_files(
			new Map([
				[`/proc/${pid}/stat`, `1 (node) ${Array.from({ length: 19 }, () => "0").join(" ")} start\n`],
				["/proc/sys/kernel/random/boot_id", "review-process-test-boot\n"],
			]),
		);
		const child = new ReviewAgentChildProcess(pid, Readable.from([]), Readable.from([]));
		const review_process = new ReviewAgentProcessTestDriver(child, {
			pid: 0,
			output: [],
			stdout: "",
			stderr: "",
			status: 0,
			signal: null,
		});
		const signal = new NodeProcessSignal(process, file_io, process.platform);
		const review_agent_process = new ReviewAgentProcess(file_io, review_process, process.platform, signal);
		const failure = review_agent_process.persist({
			root,
			child,
			ownership_token: "test-token",
		});
		const stored_identity = file_io.file(identity_file).file_text();

		expect({
			failure,
			persisted: file_io.file(identity_file).path_exists(),
			ownership_token: stored_identity.includes("test-token"),
		}).toEqual({
			failure: "",
			persisted: true,
			ownership_token: true,
		});
	});

	test("passes an ownership token to the child process environment", async () => {
		const pid = 4321;
		const root = "/virtual/review-process-token";
		const file_io = new InMemoryFileIO();
		file_io.seed_files(
			new Map([
				[`/proc/${pid}/stat`, `1 (node) ${Array.from({ length: 19 }, () => "0").join(" ")} start\n`],
				["/proc/sys/kernel/random/boot_id", "review-process-test-boot\n"],
			]),
		);
		const child = new ReviewAgentChildProcess(pid, Readable.from([]), Readable.from([]));
		const review_process = new ReviewAgentProcessTestDriver(child, {
			pid: 0,
			output: [],
			stdout: "",
			stderr: "",
			status: 0,
			signal: null,
		});
		const signal = new NodeProcessSignal(process, file_io, process.platform);
		const review_agent_process = new ReviewAgentProcess(file_io, review_process, process.platform, signal);
		const result = review_agent_process.run_async({
			command: "codex",
			arguments_list: [],
			root,
		});
		const token = review_process.spawn_environment_value(0, REVIEW_AGENT_GROUP_TOKEN_VARIABLE);
		child.emit("close", { received: true, code: 0 });
		const completed = await result;

		expect({ token, exit_code: completed.exit_code }).toEqual({ token: expect.any(String), exit_code: 0 });
	});
});
