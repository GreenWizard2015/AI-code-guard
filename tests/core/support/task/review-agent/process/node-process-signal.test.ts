import "src/core/lint_project_context_creator";
import { constants } from "node:os";
import { describe, expect, test } from "@jest/globals";
import type { OwnedProcessGroup, ProcessKillContract } from "src/analysis_protocols";
import { REVIEW_AGENT_GROUP_TOKEN_VARIABLE } from "src/core/support/task/review-agent/constants";
import { NodeProcessSignal } from "src/core/support/task/review-agent/process/node_process_signal";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

describe("Node process group ownership", () => {
	test("matches the ownership token only inside the requested process group", () => {
		const file_io = new InMemoryFileIO();
		file_io.seed_files(
			new Map([
				["/proc/9001/stat", "9001 (agent) S 1 4321 4321 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0\n"],
				["/proc/9001/environ", `${REVIEW_AGENT_GROUP_TOKEN_VARIABLE}=owned-token\u0000PATH=/bin\u0000`],
				["/proc/9002/stat", "9002 (unrelated) S 1 7777 7777 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0\n"],
				["/proc/9002/environ", `${REVIEW_AGENT_GROUP_TOKEN_VARIABLE}=other-token\u0000PATH=/bin\u0000`],
			]),
		);
		const signal = new NodeProcessSignal(process, file_io, "linux");

		expect({
			matching_group: signal.group_contains_token({ id: 4321, token: "owned-token" }),
			other_group: signal.group_contains_token({ id: 7777, token: "owned-token" }),
		}).toEqual({ matching_group: true, other_group: false });
	});

	test("rejects a different ownership token in the same group", () => {
		const file_io = new InMemoryFileIO();
		file_io.seed_files(
			new Map([
				["/proc/9011/stat", "9011 (agent) S 1 4321 4321 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0\n"],
				["/proc/9011/environ", `${REVIEW_AGENT_GROUP_TOKEN_VARIABLE}=another-token\u0000`],
			]),
		);
		const signal = new NodeProcessSignal(process, file_io, "linux");

		expect(signal.group_contains_token({ id: 4321, token: "owned-token" })).toBe(false);
	});

	test("does not inspect Unix process groups on Windows", () => {
		const signal = new NodeProcessSignal(process, new InMemoryFileIO(), "win32");

		expect(signal.group_contains_token({ id: 4321, token: "owned-token" })).toBe(false);
	});

	test("does not send termination signals without matching live-group ownership", () => {
		const scenarios: {
			readonly ownership: OwnedProcessGroup;
			readonly process_id: number;
			readonly group_id: number;
			readonly token: string;
		}[] = [
			{
				ownership: { id: 4321, token: "owned-token" },
				process_id: 9001,
				group_id: 4321,
				token: "",
			},
			{
				ownership: { id: 4321, token: "owned-token" },
				process_id: 9001,
				group_id: 4321,
				token: "different-token",
			},
			{
				ownership: { id: 4321, token: "owned-token" },
				process_id: 9001,
				group_id: 7777,
				token: "owned-token",
			},
		];
		const results = scenarios.map(({ ownership, process_id, group_id, token }) => {
			const file_io = new InMemoryFileIO();
			const stat = `${process_id} (agent) S 1 ${group_id} ${group_id} 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0\n`;
			let environment = "PATH=/bin\u0000";
			if (token.length > 0) {
				environment = `${REVIEW_AGENT_GROUP_TOKEN_VARIABLE}=${token}\u0000${environment}`;
			}
			file_io.seed_files(
				new Map([
					[`/proc/${process_id}/stat`, stat],
					[`/proc/${process_id}/environ`, environment],
				]),
			);
			const calls: { readonly pid: number; readonly signal: number }[] = [];
			const process_api: ProcessKillContract = {
				kill: (pid, signal) => {
					calls.push({ pid, signal });
					return true;
				},
			};
			const process_signal = new NodeProcessSignal(process_api, file_io, "linux");
			const terminated = process_signal.terminate_owned_group(ownership);
			return {
				terminated,
				termination_signals: calls.filter(({ signal }) => signal !== 0),
			};
		});

		expect(results).toEqual([
			{ terminated: false, termination_signals: [] },
			{ terminated: false, termination_signals: [] },
			{ terminated: false, termination_signals: [] },
		]);
	});

	test("signals only the process group that proves the ownership token", () => {
		const file_io = new InMemoryFileIO();
		file_io.seed_files(
			new Map([
				["/proc/9001/stat", "9001 (agent) S 1 4321 4321 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0\n"],
				["/proc/9001/environ", `${REVIEW_AGENT_GROUP_TOKEN_VARIABLE}=owned-token\u0000PATH=/bin\u0000`],
			]),
		);
		let group_is_live = true;
		const calls: { readonly pid: number; readonly signal: number }[] = [];
		const process_api: ProcessKillContract = {
			kill: (pid, signal) => {
				calls.push({ pid, signal });
				if (signal === 0) {
					return group_is_live;
				}
				if (signal === constants.signals.SIGKILL) {
					group_is_live = false;
				}
				return true;
			},
		};
		const process_signal = new NodeProcessSignal(process_api, file_io, "linux");

		const terminated = process_signal.terminate_owned_group({ id: 4321, token: "owned-token" });

		expect({ terminated, calls }).toEqual({
			terminated: true,
			calls: [
				{ pid: -4321, signal: 0 },
				{ pid: -4321, signal: constants.signals.SIGTERM },
				{ pid: -4321, signal: constants.signals.SIGKILL },
				{ pid: -4321, signal: 0 },
			],
		});
	});
});
