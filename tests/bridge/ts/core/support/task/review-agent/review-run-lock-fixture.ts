import { join } from "node:path";
import { jest } from "@jest/globals";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

/** Responsibilities: _process identity_, _lock owner state_. **/
export class ReviewRunLockFixture {
	/** Responsibilities: _owner identity state_. **/
	public watch_recycled_agent(root: string, file_io: InMemoryFileIO): { terminated_pids: number[]; restore(): void } {
		const lock_path = join(root, ".ai-code-guard", "review", ".review-run-lock");
		const agents_path = join(lock_path, "agents");
		file_io.directory_operations.create_directory(agents_path);
		file_io.file_content.write_text(join(lock_path, "owner"), "999999999\nstale-owner\n");
		file_io.file_content.write_text(
			join(agents_path, "4321"),
			JSON.stringify({ pid: 4321, start_time: "old-process", boot_id: "old-boot" }),
		);
		file_io.directory_operations.create_directory("/proc/4321");
		file_io.directory_operations.create_directory("/proc/sys/kernel/random");
		const stat_fields = Array.from({ length: 19 }, () => "0");
		stat_fields.push("current-process");
		file_io.file_content.write_text("/proc/4321/stat", `4321 (agent) ${stat_fields.join(" ")}`);
		file_io.file_content.write_text("/proc/sys/kernel/random/boot_id", "current-boot\n");
		const original_kill = process.kill;
		const terminated_pids: number[] = [];
		const kill = jest.spyOn(process, "kill").mockImplementation((pid, signal) => {
			if (pid < 0) {
				terminated_pids.push(pid);
				return true;
			}
			return original_kill.call(process, pid, signal);
		});
		return { terminated_pids, restore: () => kill.mockRestore() };
	}
}
