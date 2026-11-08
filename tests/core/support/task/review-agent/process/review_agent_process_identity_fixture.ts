import { constants } from "node:os";
import { Readable } from "node:stream";
import type { ProcessKillContract } from "src/analysis_protocols";
import {
	AI_CODE_GUARD_DIRECTORY,
	REVIEW_AGENT_DIRECTORY,
	REVIEW_AGENT_GROUP_TOKEN_VARIABLE,
	REVIEW_DIRECTORY,
	REVIEW_RUN_LOCK_DIRECTORY,
} from "src/core/support/task/review-agent/constants";
import { NodeProcessSignal } from "src/core/support/task/review-agent/process/node_process_signal";
import type { ReviewAgentProcessExecution } from "src/core/support/task/review-agent/protocols";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { ReviewAgentChildProcess } from "tests/bridge/ts/core/review-agent/review-agent-child-process";
import { ReviewAgentProcessTestDriver } from "tests/bridge/ts/core/review-agent/review-agent-process-test-driver";

/** Responsibilities: _review process identity fixtures_, _process group lifecycle_. **/
export class ReviewAgentProcessIdentityFixture {
	private readonly _file_io: InMemoryFileIO;
	private readonly _pid: number;
	private readonly _descendant_pid: number;
	private readonly _root: string;
	private readonly _child: ReviewAgentChildProcess;
	private readonly _driver: ReviewAgentProcessTestDriver;
	private readonly _process_api: ProcessKillContract;
	private readonly _signals: number[];
	private readonly _group_live: Map<string, boolean>;

	/** Responsibilities: _process group signaling_. **/
	private signal_group(process_id: number, signal: number): boolean {
		if (process_id !== -this._pid) {
			return false;
		}
		if (signal === 0) {
			return this._group_live.get("live") === true;
		}
		this._signals.push(process_id, signal);
		if (signal === constants.signals.SIGKILL) {
			this._group_live.set("live", false);
		}
		return true;
	}

	/** Responsibilities: _review identity path_. **/
	private identity_file(): string {
		return `${this._root}/${AI_CODE_GUARD_DIRECTORY}/${REVIEW_DIRECTORY}/${REVIEW_RUN_LOCK_DIRECTORY}/${REVIEW_AGENT_DIRECTORY}/${this._pid}`;
	}

	/** Responsibilities: _process fixture initialization_. **/
	public constructor(pid = 4321, descendant_pid = 4322, root = "/virtual/review-process-token") {
		this._file_io = new InMemoryFileIO();
		this._pid = pid;
		this._descendant_pid = descendant_pid;
		this._root = root;
		this._child = new ReviewAgentChildProcess(pid, Readable.from([]), Readable.from([]));
		this._driver = new ReviewAgentProcessTestDriver(this._child, {
			pid: 0,
			output: [],
			stdout: "",
			stderr: "",
			status: 0,
			signal: null,
		});
		this._signals = [];
		this._group_live = new Map<string, boolean>([["live", true]]);
		this._process_api = { kill: (process_id, signal) => this.signal_group(process_id, signal) };
	}

	/** Responsibilities: _process identity records_. **/
	public seed_process_identity(): void {
		const stat_fields = Array.from({ length: 19 }, () => "0").join(" ");
		this._file_io.seed_files(
			new Map([
				[`/proc/${this._pid}/stat`, `1 (node) ${stat_fields} start\n`],
				["/proc/sys/kernel/random/boot_id", "review-process-test-boot\n"],
			]),
		);
	}

	/** Responsibilities: _owned process records_. **/
	public seed_owned_process(): void {
		const stat_padding = "0 ".repeat(15);
		this._file_io.seed_files(
			new Map([
				[`/proc/${this._pid}/stat`, `1 (node) S 1 ${this._pid} ${this._pid} ${stat_padding}child-start\n`],
				[`/proc/${this._pid}/environ`, "PATH=/bin\u0000"],
				[
					`/proc/${this._descendant_pid}/stat`,
					`1 (node) S ${this._pid} ${this._pid} ${stat_padding}descendant-start\n`,
				],
				["/proc/sys/kernel/random/boot_id", "review-process-test-boot\n"],
			]),
		);
	}

	/** Responsibilities: _review process collaborators_. **/
	public process_dependencies(platform: NodeJS.Platform): {
		file_io: InMemoryFileIO;
		spawner: ReviewAgentProcessTestDriver;
		platform: NodeJS.Platform;
		process_signal: NodeProcessSignal;
	} {
		const process_signal = new NodeProcessSignal(this._process_api, this._file_io, platform);
		return { file_io: this._file_io, spawner: this._driver, platform, process_signal };
	}

	/** Responsibilities: _child process execution state_. **/
	public process_execution(ownership_token: string): ReviewAgentProcessExecution {
		return { root: this._root, child: this._child, ownership_token };
	}

	/** Responsibilities: _identity persistence check_. **/
	public identity_file_exists(): boolean {
		return this._file_io.file(this.identity_file()).path_exists();
	}

	/** Responsibilities: _review ownership token extraction_. **/
	public persisted_token(): string {
		const contents = this._file_io.file(this.identity_file()).file_text();
		const fields = contents.split(/\r?\n/u);
		return fields[3] ?? "";
	}

	/** Responsibilities: _spawned ownership token_. **/
	public spawned_token(): string {
		return this._driver.spawn_environment_value(0, REVIEW_AGENT_GROUP_TOKEN_VARIABLE);
	}

	/** Responsibilities: _descendant token setup_. **/
	public seed_descendant_token(token: string): string {
		const environment = `${REVIEW_AGENT_GROUP_TOKEN_VARIABLE}=${token}\u0000`;
		this._file_io.file(`/proc/${this._descendant_pid}/environ`).write_text(environment);
		return environment;
	}

	/** Responsibilities: _descendant environment observation_. **/
	public observed_descendant_environment(): string {
		return this._file_io.file(`/proc/${this._descendant_pid}/environ`).file_text();
	}

	/** Responsibilities: _child process completion_. **/
	public finish_child(): void {
		this._child.emit("close", { received: true, code: 0 });
	}

	/** Responsibilities: _identity file cleanup check_. **/
	public identity_removed(): boolean {
		return !this.identity_file_exists();
	}

	/** Responsibilities: _process group signal history_. **/
	public termination_signals(): number[] {
		return [...this._signals];
	}

	/** Responsibilities: _process group liveness_. **/
	public process_group_live(): boolean {
		return this._group_live.get("live") === true;
	}
}
