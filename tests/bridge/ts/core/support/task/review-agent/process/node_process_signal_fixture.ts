import { constants } from "node:os";
import type { ProcessKillContract } from "src/analysis_protocols";
import { REVIEW_AGENT_GROUP_TOKEN_VARIABLE } from "src/core/support/task/review-agent/constants";
import { NodeProcessSignal } from "src/core/support/task/review-agent/process/node_process_signal";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

/** Responsibilities: _in-memory process inventory_, _group liveness_, _termination signal history_. **/
export class NodeProcessSignalFixture {
	private readonly _kill_calls: { readonly pid: number; readonly signal: number }[];
	private _group_is_live: boolean;
	private readonly _process_signal: NodeProcessSignal;

	/** Responsibilities: _process record data_. **/
	private process_files(
		records: ConstructorParameters<typeof NodeProcessSignalFixture>[0],
	): ReadonlyMap<string, string> {
		const files = new Map<string, string>();
		for (const record of records) {
			const process_id = record.process_id;
			const group_id = record.group_id;
			const stat = `${process_id} (agent) S 1 ${group_id} ${group_id} 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0\n`;
			let environment = "PATH=/bin\u0000";
			if (record.token.length > 0) {
				environment = `${REVIEW_AGENT_GROUP_TOKEN_VARIABLE}=${record.token}\u0000${environment}`;
			}
			files.set(`/proc/${process_id}/stat`, stat);
			files.set(`/proc/${process_id}/environ`, environment);
		}
		return files;
	}

	/** Responsibilities: _process signal state_. **/
	private record_signal(pid: number, signal: number): boolean {
		this._kill_calls.push({ pid, signal });
		if (signal === 0) {
			return this._group_is_live;
		}
		if (signal === constants.signals.SIGKILL) {
			this._group_is_live = false;
		}
		return true;
	}

	/** Responsibilities: _fixture initialization_. **/
	public constructor(
		records: readonly { readonly process_id: number; readonly group_id: number; readonly token: string }[],
	) {
		this._kill_calls = [];
		this._group_is_live = true;
		const file_io = new InMemoryFileIO();
		file_io.seed_files(this.process_files(records));
		const process_api: ProcessKillContract = {
			kill: (pid, signal) => this.record_signal(pid, signal),
		};
		this._process_signal = new NodeProcessSignal(process_api, file_io, "linux");
	}

	/** Responsibilities: _process signal boundary_. **/
	public process_signal(): NodeProcessSignal {
		return this._process_signal;
	}

	/** Responsibilities: _termination signal history_. **/
	public signals(): Readonly<typeof this._kill_calls> {
		return this._kill_calls;
	}
}
