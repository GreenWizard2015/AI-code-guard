import type { SpawnSyncReturns } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { SystemFailureClassificationContract } from "src/analysis_protocols";
import {
	REVIEW_AGENT_GROUP_TOKEN_VARIABLE,
	REVIEW_AGENT_PROCESS_TIMEOUT_MS,
	REVIEW_PREFIX_ARGUMENT,
} from "src/core/support/task/review-agent/constants";
import { ReviewAgentProcessLifecycle } from "src/core/support/task/review-agent/process/review_agent_process_lifecycle";
import { ReviewAgentProcessTerminator } from "src/core/support/task/review-agent/process/review_agent_process_terminator";
import type {
	ReviewAgentAsyncOutput,
	ReviewAgentHookProcessRequest,
	ReviewAgentProcessContract,
	ReviewAgentProcessExecution,
	ReviewAgentProcessLifecycleContract,
	ReviewAgentProcessRegistrationContract,
	ReviewAgentProcessRequest,
	ReviewAgentProcessSignalContract,
	ReviewAgentProcessSpawnerContract,
	ReviewAgentProcessTerminatorContract,
} from "src/core/support/task/review-agent/protocols";
import type { RawHookPayload } from "src/core/support/task/review-agent/types";
import { ReviewAgentIdentity } from "src/core/support/task/review_agent_identity";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";
import { SYSTEM_FAILURE_CODES } from "src/io/constants";
import type { IOContract } from "src/io/protocols";
import type { ReviewAgentHookEvent, ReviewAgentProcessResult } from "src/task_review_types";

/** Responsibilities: _review-agent process execution_, _agent hook lifecycle handling_. **/
export class ReviewAgentProcess implements ReviewAgentProcessContract, ReviewAgentProcessRegistrationContract {
	private readonly _process_timeout_ms: number;
	private readonly _boundary_failures: SystemFailureClassificationContract;
	private readonly _terminator: ReviewAgentProcessTerminatorContract;
	private readonly _identity_reader: ReviewAgentIdentity;
	private readonly _lifecycle: ReviewAgentProcessLifecycleContract;
	private readonly _spawner: ReviewAgentProcessSpawnerContract;
	private readonly _platform: NodeJS.Platform;

	/** Responsibilities: _hook subprocess execution_. **/
	private spawn_process(request: ReviewAgentHookProcessRequest): SpawnSyncReturns<string> {
		return this._spawner.spawn_sync(
			request.command,
			[request.hook_file, REVIEW_PREFIX_ARGUMENT, request.event.context.review_prefix],
			{
				cwd: request.root,
				encoding: "utf8",
				input: JSON.stringify(this.hook_payload(request.event)),
				maxBuffer: 2 * 1024 * 1024,
				timeout: this._process_timeout_ms,
			},
		);
	}

	/** Responsibilities: _hook subprocess output normalization_. **/
	private process_output(result: SpawnSyncReturns<string>): ReviewAgentAsyncOutput {
		let stdout = "";
		if (result.stdout !== null && result.stdout !== undefined) {
			stdout = result.stdout.toString();
		}
		let stderr = "";
		if (result.stderr !== null && result.stderr !== undefined) {
			stderr = result.stderr.toString();
		}
		return {
			stdout,
			stderr,
		};
	}

	/** Responsibilities: _review-agent hook payload assembly_. **/
	private hook_payload(event: ReviewAgentHookEvent): RawHookPayload {
		return {
			event: event.context.event,
			hook_event_name: "",
			stop_hook_active: false,
			tool_name: event.tool.name,
			tool_input: {
				command: event.tool.input,
				cmd: "",
				file_path: "",
				path: "",
				patch: "",
				workdir: "",
				shell: "",
				login: false,
			},
			cwd: event.context.root,
			review_stage: event.context.review_stage,
			review_prefix: event.context.review_prefix,
		};
	}

	/** Responsibilities: _review-agent execution state creation_. **/
	private create_execution(request: ReviewAgentProcessRequest): ReviewAgentProcessExecution {
		const ownership_token = randomUUID();
		return {
			root: request.root,
			ownership_token,
			child: this._spawner.spawn_child(request.command, request.arguments_list, {
				cwd: request.root,
				stdio: ["ignore", "pipe", "pipe"],
				detached: this._platform !== "win32",
				env: { ...process.env, [REVIEW_AGENT_GROUP_TOKEN_VARIABLE]: ownership_token },
			}),
		};
	}

	/** Responsibilities: _review-agent process collaborator initialization_. **/
	public constructor(
		file_io: IOContract,
		spawner: ReviewAgentProcessSpawnerContract,
		platform: NodeJS.Platform,
		process_signal: ReviewAgentProcessSignalContract,
	) {
		this._spawner = spawner;
		this._platform = platform;
		this._process_timeout_ms = REVIEW_AGENT_PROCESS_TIMEOUT_MS;
		this._boundary_failures = new BoundaryFailureClassifier(SYSTEM_FAILURE_CODES);
		this._terminator = new ReviewAgentProcessTerminator(this._boundary_failures, process_signal, platform);
		this._identity_reader = new ReviewAgentIdentity({
			pid: 0,
			start_time: "",
			boot_id: "",
			available: false,
			file_io,
			ownership_token: "",
		});
		this._lifecycle = new ReviewAgentProcessLifecycle({
			process_timeout_ms: this._process_timeout_ms,
			boundary_failures: this._boundary_failures,
			terminator: this._terminator,
			cleanup: this._identity_reader,
			registration: this,
		});
	}

	/** Responsibilities: _child process identity registration_. **/
	public persist(execution: ReviewAgentProcessExecution): string {
		if (!execution.child.identified()) {
			return "Review agent child has no process id";
		}
		const identity = this._identity_reader.from_process({ value: execution.child.identifier() });
		return identity.persist(execution.root, execution.ownership_token);
	}

	/** Responsibilities: _review-agent parallel process execution_. **/
	public run_async(request: ReviewAgentProcessRequest): Promise<ReviewAgentProcessResult> {
		return new Promise((resolve_result) => {
			const execution = this.create_execution(request);
			this._lifecycle.attach(execution, resolve_result);
		});
	}

	/** Responsibilities: _review-agent command availability_. **/
	public available(provider_command: string): boolean {
		const result = this._spawner.spawn_sync(provider_command, ["--version"], {
			cwd: process.cwd(),
			encoding: "utf8",
			input: "",
			stdio: ["pipe", "ignore", "ignore"],
			timeout: this._process_timeout_ms,
		});
		return result.error === undefined && result.status === 0;
	}

	/** Responsibilities: _review-agent hook execution_. **/
	public run_hook(request: ReviewAgentHookProcessRequest): ReviewAgentProcessResult {
		const result = this.spawn_process(request);
		let exit_code = 1;
		if (result.status !== null) {
			exit_code = result.status;
		}
		const output = this.process_output(result);
		let stderr = output.stderr;
		if (result.error !== undefined) {
			stderr += result.error.message;
		}
		return { exit_code, stdout: output.stdout, stderr };
	}
}
