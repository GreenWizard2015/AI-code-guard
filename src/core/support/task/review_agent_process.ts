import { spawn, spawnSync } from "node:child_process";
import type {
	ChildProcess,
	SpawnOptions,
	SpawnSyncOptionsWithStringEncoding,
	SpawnSyncReturns,
} from "node:child_process";
import { rmSync } from "node:fs";
import { join, resolve } from "node:path";
import {
	AI_CODE_GUARD_DIRECTORY,
	REVIEW_AGENT_DIRECTORY,
	REVIEW_DIRECTORY,
	REVIEW_PHASE_ARGUMENT,
	REVIEW_PREFIX_ARGUMENT,
	REVIEW_RUN_LOCK_DIRECTORY,
} from "src/core/support/task/review-agent/constants";
import { ReviewAgentOutputCollector } from "src/core/support/task/review-agent/review_agent_output_collector";
import { ReviewAgentProcessState } from "src/core/support/task/review-agent/review_agent_process_state";
import type { ReviewAgentProcessContract } from "src/core/support/task/review-agent/protocols";
import { ReviewAgentIdentity } from "src/core/support/task/review_agent_identity";
import type {
	ReviewAgentAsyncOutput,
	ReviewAgentCloseState,
	ReviewAgentEscalationCallback,
	ReviewAgentProbeResult,
	ReviewAgentProcessStateContract,
	ReviewAgentResultResolver,
} from "src/core/support/task/review-agent/types";
import { NodeFileIO } from "src/io/node_file_io";
import type { ReviewAgentHookEventContract, ReviewAgentProcessResult } from "src/types";

/** Responsibilities: _review-agent process execution_, _agent hook lifecycle handling_. **/
export class ReviewAgentProcess implements ReviewAgentProcessContract {
	private readonly process_timeout_ms = 10 * 60 * 1000;

	/** Responsibilities: _synchronous subprocess boundary_. **/
	protected spawn_sync(
		command: string,
		arguments_list: readonly string[],
		options: SpawnSyncOptionsWithStringEncoding,
	): SpawnSyncReturns<string> {
		return spawnSync(command, [...arguments_list], options);
	}

	/** Responsibilities: _hook subprocess execution_. **/
	private spawn_process(
		command: string,
		arguments_list: readonly string[],
		root: string,
		input: string,
		max_buffer: number,
	): ReturnType<typeof spawnSync> {
		return this.spawn_sync(command, arguments_list, {
			cwd: root,
			encoding: "utf8",
			input,
			maxBuffer: max_buffer,
			timeout: this.process_timeout_ms,
		});
	}

	/** Responsibilities: _hook subprocess output normalization_. **/
	private process_output(result: ReturnType<typeof spawnSync>): ReviewAgentAsyncOutput {
		let stdout = "";
		if (result.stdout !== undefined) {
			stdout = result.stdout.toString();
		}
		let stderr = "";
		if (result.stderr !== undefined) {
			stderr = result.stderr.toString();
		}
		return { stdout, stderr };
	}

	/** Responsibilities: _review-agent timeout escalation_. **/
	private escalation_state(
		child: ChildProcess,
		state: ReviewAgentProcessStateContract,
		finished: ReviewAgentEscalationCallback,
	): ReviewAgentProcessStateContract {
		const timed_out = state.timed_out_state();
		this.terminate_agent(child, "SIGTERM");
		const timer = setTimeout(() => {
			this.terminate_agent(child, "SIGKILL");
			finished();
		}, 1000);
		return timed_out.escalation_state(timer);
	}

	/** Responsibilities: _lifecycle state_. **/
	private close_state(
		output: ReviewAgentAsyncOutput,
		resolve: ReviewAgentResultResolver,
		timer: ReturnType<typeof setTimeout>,
	): ReviewAgentCloseState {
		return {
			state: new ReviewAgentProcessState(output, resolve, timer, [], []),
			timed_out: false,
			escalation_finished: false,
			process_closed: false,
			closed_exit_code: 1,
		};
	}

	/** Responsibilities: _review-agent completion event handling_. **/
	private attach_completion_handlers(child: ChildProcess, lifecycle: ReviewAgentCloseState): void {
		child.once("error", (error) => {
			lifecycle.state = lifecycle.state.error_state(error.message);
		});
		child.once("close", (exit_code) => {
			if (exit_code === null) {
				lifecycle.closed_exit_code = 1;
			} else {
				lifecycle.closed_exit_code = exit_code;
			}
			lifecycle.process_closed = true;
			if (lifecycle.timed_out && !lifecycle.escalation_finished) {
				return;
			}
			lifecycle.state.complete(lifecycle.closed_exit_code);
		});
	}

	/** Responsibilities: _review-agent asynchronous lifecycle handlers_. **/
	private attach_async_handlers(
		child: ChildProcess,
		output: ReviewAgentAsyncOutput,
		resolve: ReviewAgentResultResolver,
	): void {
		let lifecycle: ReviewAgentCloseState;
		const timer = setTimeout(() => {
			lifecycle.timed_out = true;
			lifecycle.state = this.escalation_state(child, lifecycle.state, () => {
				lifecycle.escalation_finished = true;
				if (lifecycle.process_closed) {
					lifecycle.state.complete(lifecycle.closed_exit_code);
				}
			});
		}, this.process_timeout_ms);
		lifecycle = this.close_state(output, resolve, timer);
		const collector = new ReviewAgentOutputCollector(output);
		collector.attach_stdout(child);
		collector.attach_stderr(child);
		this.attach_completion_handlers(child, lifecycle);
	}

	/** Responsibilities: _review-agent child creation_. **/
	protected spawn_child(command: string, arguments_list: readonly string[], options: SpawnOptions): ChildProcess {
		return spawn(command, [...arguments_list], options);
	}

	/** Responsibilities: _provider availability probe_. **/
	protected probe_agent(command: string): ReviewAgentProbeResult {
		const result = this.spawn_sync(command, ["--version"], {
			encoding: "utf8",
			stdio: "ignore",
			timeout: this.process_timeout_ms,
		});
		let status = 1;
		if (result.status !== null) {
			status = result.status;
		}
		return { failed: result.error !== undefined, status };
	}

	/** Responsibilities: _review-agent child creation_. **/
	protected create_agent(command: string, arguments_list: readonly string[], root: string): ChildProcess {
		return this.spawn_child(command, arguments_list, {
			cwd: root,
			stdio: ["ignore", "pipe", "pipe"],
			detached: process.platform !== "win32",
		});
	}

	/** Responsibilities: _review-agent ownership registration_. **/
	/** Responsibilities: _review-agent ownership registration_. **/
	private register_agent(root: string, child: ChildProcess): void {
		if (child.pid === undefined) {
			return;
		}
		const identity_reader = new ReviewAgentIdentity(0, "", "", false, new NodeFileIO());
		const identity = identity_reader.from_process(child.pid);
		identity.persist(root);
	}

	/** Responsibilities: _review-agent ownership cleanup_. **/
	protected unregister_agent(root: string, child: ChildProcess): string {
		if (child.pid === undefined) {
			return "";
		}
		const path = join(
			resolve(root),
			AI_CODE_GUARD_DIRECTORY,
			REVIEW_DIRECTORY,
			REVIEW_RUN_LOCK_DIRECTORY,
			REVIEW_AGENT_DIRECTORY,
			String(child.pid),
		);
		try {
			rmSync(path, { force: true });
			return "";
		} catch (error) {
			return String(error);
		}
	}

	/** Responsibilities: _review-agent process termination_. **/
	protected terminate_agent(child: ChildProcess, signal: NodeJS.Signals): void {
		try {
			if (process.platform !== "win32" && child.pid !== undefined) {
				process.kill(-child.pid, signal);
				return;
			}
			child.kill(signal);
		} catch (error) {
			void error;
		}
	}

	/** Responsibilities: _review-agent hook payload assembly_. **/
	private hook_payload(event: ReviewAgentHookEventContract): ReviewAgentHookEventContract {
		return {
			event: event.event,
			provider: event.provider,
			root: event.root,
			review_root: event.review_root,
			hook_file: event.hook_file,
			review_stage: event.review_stage,
			review_prefix: event.review_prefix,
			review_phase: event.review_phase,
			tool_name: event.tool_name,
			tool_input: event.tool_input,
			exit_code: event.exit_code,
			stdout: event.stdout,
			stderr: event.stderr,
		};
	}

	/** Responsibilities: _review-agent result settlement_. **/
	private settled_result(
		root: string,
		child: ChildProcess,
		result: ReviewAgentProcessResult,
	): ReviewAgentProcessResult {
		try {
			const cleanup_error = this.unregister_agent(root, child);
			if (cleanup_error.length === 0) {
				return result;
			}
			return {
				exit_code: 1,
				stdout: result.stdout,
				stderr: `${result.stderr}\nReview agent cleanup failed: ${cleanup_error}`,
			};
		} catch (error) {
			return {
				exit_code: 1,
				stdout: result.stdout,
				stderr: `${result.stderr}\nReview agent cleanup failed: ${String(error)}`,
			};
		}
	}

	/** Responsibilities: _review-agent parallel process execution_. **/
	public run_async(
		command: string,
		arguments_list: readonly string[],
		root: string,
	): Promise<ReviewAgentProcessResult> {
		return new Promise((resolve) => {
			const child = this.create_agent(command, arguments_list, root);
			this.register_agent(root, child);
			const output: ReviewAgentAsyncOutput = { stdout: "", stderr: "" };
			let settled = false;
			const complete = (result: ReviewAgentProcessResult): void => {
				if (settled) {
					return;
				}
				settled = true;
				resolve(this.settled_result(root, child, result));
			};
			this.attach_async_handlers(child, output, complete);
		});
	}

	/** Responsibilities: _review-agent command availability_. **/
	public available(command: string): boolean {
		const result = this.probe_agent(command);
		if (result.failed) {
			return false;
		}
		if (result.status !== 0) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _review-agent hook execution_. **/
	public run_hook(
		command: string,
		hook_file: string,
		event: ReviewAgentHookEventContract,
		root: string,
	): ReviewAgentProcessResult {
		const result = this.spawn_process(
			command,
			[hook_file, REVIEW_PREFIX_ARGUMENT, event.review_prefix, REVIEW_PHASE_ARGUMENT, event.review_phase],
			root,
			JSON.stringify(this.hook_payload(event)),
			2 * 1024 * 1024,
		);
		let exit_code = 1;
		if (result.status !== null) {
			exit_code = result.status;
		}
		const output = this.process_output(result);
		let stderr = output.stderr;
		if (result.error !== undefined) {
			stderr = `${stderr}${result.error.message}`;
		}
		return { exit_code, stdout: output.stdout, stderr };
	}
}
