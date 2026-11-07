import type { SpawnOptions, SpawnSyncOptionsWithStringEncoding, SpawnSyncReturns } from "node:child_process";
import type {
	ReviewAgentChildProcessContract,
	ReviewAgentProcessSpawnerContract,
} from "src/core/support/task/review-agent/protocols";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import type { ReviewAgentChildProcess } from "tests/bridge/ts/core/review-agent/review-agent-child-process";

/** Responsibilities: _child process simulation_, _spawn option observation_. **/
export class FakeReviewAgentProcess implements ReviewAgentProcessSpawnerContract {
	private readonly _child: ReviewAgentChildProcess;
	private readonly _spawn_options_list: SpawnOptions[];
	private readonly _file_io: InMemoryFileIO;

	/** Responsibilities: _fake process initialization_. **/
	public constructor(child: ReviewAgentChildProcess) {
		const file_io = new InMemoryFileIO();
		const pid = child.identifier();
		const stat_fields = ["S", ...Array.from({ length: 18 }, () => "field"), "1234"];
		file_io.seed_files(
			new Map([
				[`/proc/${pid}/stat`, `${pid} (review agent) ${stat_fields.join(" ")}`],
				["/proc/sys/kernel/random/boot_id", "test-boot-id\n"],
			]),
		);
		this._child = child;
		this._spawn_options_list = [];
		this._file_io = file_io;
	}

	/** Responsibilities: _fake production child spawning_. **/
	public spawn_child(
		_command: string,
		_arguments_list: readonly string[],
		options: SpawnOptions,
	): ReviewAgentChildProcessContract {
		this._spawn_options_list.push(options);
		return this._child;
	}

	/** Responsibilities: _provider probe simulation_. **/
	public spawn_sync(
		_command: string,
		_arguments_list: readonly string[],
		_options: SpawnSyncOptionsWithStringEncoding,
	): SpawnSyncReturns<string> {
		return { pid: 0, output: [], stdout: "", stderr: "", status: 0, signal: null };
	}

	/** Responsibilities: _virtual child process access_. **/
	public child_process(): ReviewAgentChildProcess {
		return this._child;
	}

	/** Responsibilities: _review process filesystem access_. **/
	public file_io(): InMemoryFileIO {
		return this._file_io;
	}

	/** Responsibilities: _production spawn option observation_. **/
	public spawn_options(): readonly SpawnOptions[] {
		return this._spawn_options_list;
	}
}
