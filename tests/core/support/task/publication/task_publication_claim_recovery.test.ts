import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import type { ProcessLivenessContract } from "src/analysis_protocols";
import "src/core/lint_project_context_creator";
import { TaskPublicationOwner } from "src/core/support/task/publication/task_publication_owner";
import { TaskPublicationRecoveryClaim } from "src/core/support/task/publication/task_publication_recovery_claim";
import { NodeProcessSignal } from "src/core/support/task/review-agent/process/node_process_signal";
import "src/lint_stage_timer";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { InterleavingFileIO } from "tests/core/support/task/publication/interleaving-file-io";

describe("task publication claim recovery", () => {
	test("publishes one fully initialized recovery claim under an interleaving contender", () => {
		const claim_path = "/virtual/task-publication/recovery";
		const io = new InterleavingFileIO(claim_path);
		io.create_directory("/virtual/task-publication");
		const process_liveness = new NodeProcessSignal(process, io, process.platform);
		const first = new TaskPublicationRecoveryClaim(
			"/virtual/task-publication/lock",
			claim_path,
			"first",
			io,
			process_liveness,
		);
		const second = new TaskPublicationRecoveryClaim(
			"/virtual/task-publication/lock",
			claim_path,
			"second",
			io,
			process_liveness,
		);
		io.set_interleave(() => second.claim());
		expect(() => first.claim()).toThrow("Task publication recovery claim failed");

		expect({
			owner_lines: io.file(join(claim_path, "owner")).file_text().split("\n"),
		}).toEqual({ owner_lines: [String(process.pid), "second", expect.any(String), expect.any(String), ""] });
	});

	test("does not remove a replacement recovery claim after a stale-owner check", () => {
		const claim_path = "/virtual/task-publication/recovery";
		const io = new InMemoryFileIO();
		io.create_directory("/virtual/task-publication");
		io.create_directory(claim_path);
		io.file(join(claim_path, "owner")).write_text("999999999\nstale-owner\n");
		let interleave = true;
		/** Responsibilities: _replacement claim reentrancy_. **/
		function claim_replacement(): void {
			replacement.claim();
		}
		const node_signal = new NodeProcessSignal(process, io, process.platform);
		const process_liveness: ProcessLivenessContract = {
			pid_exists: (process_id) => {
				if (interleave) {
					interleave = false;
					claim_replacement();
				}
				if (process_id.value === 999999999) {
					return false;
				}
				return node_signal.pid_exists(process_id);
			},
		};
		const first = new TaskPublicationRecoveryClaim(
			"/virtual/task-publication/lock",
			claim_path,
			"first",
			io,
			process_liveness,
		);
		const replacement = new TaskPublicationRecoveryClaim(
			"/virtual/task-publication/lock",
			claim_path,
			"replacement",
			io,
			process_liveness,
		);
		const owner_resource = io.file(join(claim_path, "owner"));
		expect(() => first.claim()).toThrow(
			"Task publication lock recovery is already in progress: /virtual/task-publication/lock",
		);
		expect(
			owner_resource
				.file_text()
				.split("\n")
				.filter((line) => line.length > 0),
		).toEqual([String(process.pid), "replacement"]);
	});

	test("does not delete a replacement claim installed after stale-owner comparison", async () => {
		const claim_path = "/virtual/task-publication/recovery";
		const io = new InterleavingFileIO(claim_path);
		io.seed_stale_claim("999999999\nstale-owner\n");
		const process_liveness: ProcessLivenessContract = {
			pid_exists: (process_id) => process_id.value === process.pid,
		};
		const contender_a = new TaskPublicationRecoveryClaim(
			"/virtual/task-publication/lock",
			claim_path,
			"contender-a",
			io,
			process_liveness,
		);
		const contender_b = new TaskPublicationRecoveryClaim(
			"/virtual/task-publication/lock",
			claim_path,
			"contender-b",
			io,
			process_liveness,
		);
		let owner_after_a_claim = "";
		io.set_move_interleave(() => {
			contender_a.claim();
			owner_after_a_claim = io.file(join(claim_path, "owner")).file_text();
		});
		const claim_outcome = await Promise.resolve()
			.then(() => contender_b.claim())
			.then(
				() => "",
				(failure: Error) => failure.message,
			);
		const final_owner = io.file(join(claim_path, "owner")).file_text();
		expect({
			claim_outcome,
			owner_after_a_claim,
			final_owner,
			final_owner_identity: final_owner.split("\n").slice(0, 2),
		}).toEqual({
			claim_outcome: "Task publication lock recovery is already in progress: /virtual/task-publication/lock",
			owner_after_a_claim: final_owner,
			final_owner,
			final_owner_identity: [String(process.pid), "contender-a"],
		});
	});

	test("refuses to reclaim an ownerless directory", () => {
		const claim_path = "/virtual/task-publication/recovery";
		const io = new InterleavingFileIO(claim_path);
		io.create_directory("/virtual/task-publication");
		io.create_directory(claim_path);
		const process_liveness: ProcessLivenessContract = { pid_exists: () => false };
		const contender = new TaskPublicationRecoveryClaim(
			"/virtual/task-publication/lock",
			claim_path,
			"contender",
			io,
			process_liveness,
		);
		let move_boundary_reached = false;
		io.set_move_interleave(() => {
			move_boundary_reached = true;
		});

		expect(() => contender.claim()).toThrow("Task publication lock recovery is already in progress");
		expect({ move_boundary_reached, entries: io.list_entries(claim_path) }).toEqual({
			move_boundary_reached: false,
			entries: [],
		});
	});

	test("does not treat a reused PID as the publication lock owner", () => {
		const pid = process.pid;
		const boot_id = "test-boot";
		const file_io = new InMemoryFileIO();
		file_io.seed_files(
			new Map([
				[`/proc/${pid}/stat`, `1 (node) ${Array.from({ length: 19 }, () => "0").join(" ")} current-start\n`],
				["/proc/sys/kernel/random/boot_id", `${boot_id}\n`],
			]),
		);
		const owner = new TaskPublicationOwner(pid, "", "token", `${pid}\nold-start\n${boot_id}\n`, file_io);

		expect(owner.live()).toBe(false);
	});
});
