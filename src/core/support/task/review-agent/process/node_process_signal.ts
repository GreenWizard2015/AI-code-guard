import { constants } from "node:os";
import type {
	OwnedProcessGroup,
	ProcessGroupReference,
	ProcessId,
	ProcessKillContract,
	ProcessSignalContract,
} from "src/analysis_protocols";
import { REVIEW_AGENT_GROUP_TOKEN_VARIABLE } from "src/core/support/task/review-agent/constants";
import type {
	ReviewAgentChildProcessContract,
	ReviewAgentProcessSignalContract,
} from "src/core/support/task/review-agent/protocols";
import { SYSTEM_FAILURE_CODES } from "src/io/constants";
import type { FileEntry, IOContract } from "src/io/protocols";

/** Responsibilities: _process liveness_, _agent process-group termination_. **/
export class NodeProcessSignal implements ProcessSignalContract, ReviewAgentProcessSignalContract {
	private readonly _process_api: ProcessKillContract;
	private readonly _file_io: IOContract;
	private readonly _platform: NodeJS.Platform;

	/** Responsibilities: _process error code lookup_. **/
	private error_code(descriptor: PropertyDescriptor): string {
		if (typeof descriptor.value !== "string") {
			return "";
		}
		return descriptor.value;
	}

	/** Responsibilities: _best-effort proc record retrieval_. **/
	private process_text(path: string): string {
		try {
			return this._file_io.file(path).file_text();
		} catch (error) {
			const descriptor = Object.getOwnPropertyDescriptor(new Object(error), "code");
			let code = "";
			if (descriptor !== undefined) {
				code = this.error_code(descriptor);
			}
			if (typeof code === "string" && SYSTEM_FAILURE_CODES.includes(code)) {
				return "";
			}
			throw error;
		}
	}

	/** Responsibilities: _process-group membership resolution_. **/
	private belongs_to_group(candidate: ProcessId, expected_group: ProcessGroupReference): boolean {
		const stat = this.process_text(`/proc/${candidate.value}/stat`);
		const command_end = stat.lastIndexOf(") ");
		if (command_end < 0) {
			return false;
		}
		const group_text = stat
			.slice(command_end + 2)
			.split(" ")
			.at(2);
		return Number(group_text) === expected_group.id;
	}

	/** Responsibilities: _review ownership token verification_. **/
	private owns_process_group(member: ProcessId, claimed_group: OwnedProcessGroup): boolean {
		if (!this.belongs_to_group(member, { id: claimed_group.id })) {
			return false;
		}
		const environment = this.process_text(`/proc/${member.value}/environ`).split("\u0000");
		return environment.includes(`${REVIEW_AGENT_GROUP_TOKEN_VARIABLE}=${claimed_group.token}`);
	}

	/** Responsibilities: _process entry ownership_. **/
	private member_has_token(entry: FileEntry, owner: OwnedProcessGroup): boolean {
		if (!entry.is_directory || !/^\d+$/u.test(entry.name)) {
			return false;
		}
		return this.owns_process_group({ value: Number(entry.name) }, owner);
	}

	/** Responsibilities: _proc process inventory_, _readable proc failure handling_. **/
	private process_entries(): readonly FileEntry[] {
		try {
			return this._file_io.list_entries("/proc");
		} catch (error) {
			const descriptor = Object.getOwnPropertyDescriptor(new Object(error), "code");
			let code = "";
			if (descriptor !== undefined) {
				code = this.error_code(descriptor);
			}
			if (typeof code === "string" && SYSTEM_FAILURE_CODES.includes(code)) {
				return [];
			}
			throw error;
		}
	}

	/** Responsibilities: _process existence signal handling_. **/
	private process_exists(process_id: number): boolean {
		try {
			return this._process_api.kill(process_id, 0);
		} catch (error) {
			const descriptor = Object.getOwnPropertyDescriptor(new Object(error), "code");
			if (descriptor === undefined) {
				throw error;
			}
			const code = this.error_code(descriptor);
			if (code === "EPERM") {
				return true;
			}
			if (code === "ESRCH") {
				return false;
			}
			throw error;
		}
	}

	/** Responsibilities: _ordered process-group termination signals_. **/
	private termination_signals(target: ProcessGroupReference): boolean {
		if (!this._process_api.kill(-target.id, constants.signals.SIGTERM)) {
			return false;
		}
		return this._process_api.kill(-target.id, constants.signals.SIGKILL);
	}

	/** Responsibilities: _Node process signaling dependency_. **/
	public constructor(process_api: ProcessKillContract, file_io: IOContract, platform: NodeJS.Platform) {
		this._process_api = process_api;
		this._file_io = file_io;
		this._platform = platform;
	}

	/** Responsibilities: _review child signal delivery_. **/
	public child_signal(child: ReviewAgentChildProcessContract, signal: NodeJS.Signals): void {
		child.kill(signal);
	}

	/** Responsibilities: _review process-group signal delivery_. **/
	public group_signal(process_id: number, signal: NodeJS.Signals): void {
		const signal_number = constants.signals[signal];
		if (signal_number === undefined) {
			throw new RangeError(`Unsupported process signal: ${signal}`);
		}
		this._process_api.kill(-process_id, signal_number);
	}

	/** Responsibilities: _process liveness probe_. **/
	public pid_exists(process_id: ProcessId): boolean {
		try {
			return this._process_api.kill(process_id.value, 0);
		} catch (error) {
			const descriptor = Object.getOwnPropertyDescriptor(new Object(error), "code");
			let code = "";
			if (descriptor !== undefined) {
				code = this.error_code(descriptor);
			}
			if (code === "EPERM") {
				return true;
			}
			if (code === "ESRCH") {
				return false;
			}
			throw error;
		}
	}

	/** Responsibilities: _process group liveness probe_. **/
	public group_exists(group: ProcessGroupReference): boolean {
		if (this._platform === "win32") {
			return false;
		}
		return this.process_exists(-group.id);
	}

	/** Responsibilities: _process-group ownership verification_. **/
	public group_contains_token(owner: OwnedProcessGroup): boolean {
		if (this._platform !== "linux" || owner.token.length === 0) {
			return false;
		}
		for (const entry of this.process_entries()) {
			if (this.member_has_token(entry, owner)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _process-group termination_. **/
	public terminate_owned_group(ownership: OwnedProcessGroup): boolean {
		if (!this.group_exists({ id: ownership.id }) || !this.group_contains_token(ownership)) {
			return false;
		}
		return this.terminate_group({ id: ownership.id });
	}

	/** Responsibilities: _agent process-group termination_. **/
	public terminate_group(target: ProcessGroupReference): boolean {
		try {
			if (!this.termination_signals(target)) {
				return false;
			}
			return !this.group_exists(target);
		} catch (error) {
			const descriptor = Object.getOwnPropertyDescriptor(new Object(error), "code") ?? {};
			const code = this.error_code(descriptor);
			if (code === "ESRCH") {
				return true;
			}
			if (code === "EPERM") {
				return false;
			}
			throw error;
		}
	}
}
