import type { SpawnOptions, SpawnSyncOptionsWithStringEncoding, SpawnSyncReturns } from "node:child_process";
import type { Readable } from "node:stream";
import type { SystemFailureClassificationContract } from "src/analysis_protocols";
import type { IOContract } from "src/io/protocols";
import type { HookDecision, HookPayload, HookToolInput } from "src/model_types";
import type {
	ReviewAgentDialogueExecution,
	ReviewAgentPhase,
	ReviewStageDefinition,
	TaskReviewRunResult,
} from "src/task_review_types";
import type {
	ReviewAgentCleanupRequest,
	ReviewAgentExecutionResult,
	ReviewAgentHookEvent,
	ReviewAgentName,
	ReviewAgentProcessResult,
	ReviewAgentPromptRequest,
	ReviewAgentRequest,
	ReviewAgentRunRequest,
	ReviewAgentSelection,
} from "src/task_review_types";

/** Responsibilities: _review-agent process invocation contract_. **/
export type ReviewAgentProcessRequest = {
	readonly command: string;
	readonly arguments_list: readonly string[];
	readonly root: string;
};

/** Responsibilities: _review-agent hook execution input_. **/
export type ReviewAgentHookProcessRequest = {
	readonly command: string;
	readonly hook_file: string;
	readonly event: ReviewAgentHookEvent;
	readonly root: string;
};

/** Responsibilities: _Markdown template source_, _Markdown placeholder rendering_. **/
export interface MarkdownTemplateContract {
	placeholders(): readonly string[];
	render(placeholder: string, value: string): string;
	render_all(values: ReadonlyMap<string, string>): string;
	render_text(content: string, values: ReadonlyMap<string, string>): string;
}

/** Responsibilities: _review path policy contract_. **/
export interface ReviewPathPolicyContract {
	project_root(): string;
	allows_file(path: string): boolean;
	allows_read_path(path: string): boolean;
	allows_path_from(command_path: string, command_cwd: string): boolean;
	allows_recursive_path(command_path: string, command_cwd: string): boolean;
	write_decision(file_path: string, fallback_path: string): HookDecision;
}

/** Responsibilities: _review path containment_, _archive root lookup_. **/
export interface ResolvedReviewPathPolicyContract {
	blocks(absolute_path: string, include_ancestors: boolean): boolean;
	within_project_root(project_entry_path: string): boolean;
	allows_path_from(command_path: string, command_cwd: string): boolean;
}

export type ReviewReadCommandContext = {
	command: string;
	words: readonly string[];
	command_cwd: string;
	recursive: boolean;
};

/** Responsibilities: _review-stage mutation paths_, _review-stage ownership_. **/
export interface ReviewStageMutationScopeContract {
	paths(): string[];
	allows(paths: readonly string[]): boolean;
}

/** Responsibilities: _external review-agent process execution_. **/
export interface ReviewAgentProcessContract {
	available(command: string): boolean;
	run_async(request: ReviewAgentProcessRequest): Promise<ReviewAgentProcessResult>;
	run_hook(request: ReviewAgentHookProcessRequest): ReviewAgentProcessResult;
}

/** Responsibilities: _review-agent subprocess creation_, _review hook process execution_. **/
export interface ReviewAgentProcessSpawnerContract {
	spawn_child(
		command: string,
		arguments_list: readonly string[],
		options: SpawnOptions,
	): ReviewAgentChildProcessContract;
	spawn_sync(
		command: string,
		arguments_list: readonly string[],
		options: SpawnSyncOptionsWithStringEncoding,
	): SpawnSyncReturns<string>;
}

/** Responsibilities: _review hook command_, _review hook file_. **/
export type ReviewAgentHookConfiguration = {
	readonly command: string;
	readonly file: string;
	readonly hooks: ReviewAgentHooksContract;
};

export type CallableReviewAgentChildErrorListener = (error: Error) => void;
export type ReviewAgentChildExit = { readonly received: boolean; readonly code: number };
export type CallableReviewAgentChildCloseListener = (exit: ReviewAgentChildExit) => void;

/** Responsibilities: _child process state_, _child process events_, _child output streams_. **/
export interface ReviewAgentChildProcessContract {
	identified(): boolean;
	identifier(): number;
	stdout_stream(): Readable;
	stderr_stream(): Readable;
	on_error(listener: CallableReviewAgentChildErrorListener): void;
	on_close(listener: CallableReviewAgentChildCloseListener): void;
	kill(signal: NodeJS.Signals): boolean;
}

/** Responsibilities: _review-agent process termination_. **/
export interface ReviewAgentProcessTerminatorContract {
	terminate(child: ReviewAgentChildProcessContract, signal: NodeJS.Signals): void;
}

/** Responsibilities: _review child signaling_, _review process-group signaling_. **/
export interface ReviewAgentProcessSignalContract {
	child_signal(child: ReviewAgentChildProcessContract, signal: NodeJS.Signals): void;
	group_signal(process_id: number, signal: NodeJS.Signals): void;
}

/** Responsibilities: _review process registration removal_. **/
export interface ReviewAgentProcessCleanupContract {
	unregister_agent(execution: ReviewAgentProcessExecution): string;
}

/** Responsibilities: _agent stdout_, _agent stderr_. **/
export type ReviewAgentAsyncOutput = {
	readonly stdout: string;
	readonly stderr: string;
};

export type CallableReviewAgentOutputSnapshotReader = () => ReviewAgentAsyncOutput;

export type ReviewAgentOutputChannel = "stdout" | "stderr";

/** Responsibilities: _bounded output accumulation_, _output snapshot access_. **/
export interface ReviewAgentOutputBufferContract {
	append(channel: ReviewAgentOutputChannel, chunk: string): ReviewAgentOutputBufferContract;
	snapshot(): ReviewAgentAsyncOutput;
}

/** Responsibilities: _process lifecycle attachment_, _cleanup result settlement_. **/
export interface ReviewAgentProcessLifecycleContract {
	attach(execution: ReviewAgentProcessExecution, resolve_result: CallableReviewAgentResultResolver): void;
}

/** Responsibilities: _child process identity registration_. **/
export interface ReviewAgentProcessRegistrationContract {
	persist(execution: ReviewAgentProcessExecution): string;
}

/** Responsibilities: _child process identity_, _process working directory_. **/
export type ReviewAgentProcessExecution = {
	readonly root: string;
	readonly child: ReviewAgentChildProcessContract;
	readonly ownership_token: string;
};

/** Responsibilities: _process lifecycle dependencies_, _cleanup policy_. **/
export type ReviewAgentProcessLifecycleContext = {
	readonly process_timeout_ms: number;
	readonly boundary_failures: SystemFailureClassificationContract;
	readonly terminator: ReviewAgentProcessTerminatorContract;
	readonly cleanup: ReviewAgentProcessCleanupContract;
	readonly registration: ReviewAgentProcessRegistrationContract;
};

/** Responsibilities: _process state transition data_. **/
export type ReviewAgentProcessStateContextData = {
	readonly timer: ReturnType<typeof setTimeout>;
	readonly escalation_timers: readonly ReturnType<typeof setTimeout>[];
	readonly failure_messages: readonly string[];
};

/** Responsibilities: _review-agent process state transitions_. **/
export interface ReviewAgentProcessStateContract {
	timed_out_state(): ReviewAgentProcessStateContract;
	error_state(message: string): ReviewAgentProcessStateContract;
	escalation_state(timer: ReturnType<typeof setTimeout>): ReviewAgentProcessStateContract;
	complete(exit_code: number, output: ReviewAgentAsyncOutput): void;
}

export type CallableReviewAgentResultResolver = (result: ReviewAgentProcessResult) => void;

/** Responsibilities: _external review-agent provider execution_. **/
export interface ReviewAgentContract {
	agent_name(): ReviewAgentName;
	available(): boolean;
	run_async(request: ReviewAgentRequest): Promise<ReviewAgentProcessResult>;
}

/** Responsibilities: _review-agent selection_. **/
export interface ReviewAgentCatalogContract {
	prompt(request: ReviewAgentPromptRequest): string;
	cleanup_prompt(request: ReviewAgentCleanupRequest): string;
	run_async(selection: ReviewAgentSelection, request: ReviewAgentRunRequest): Promise<ReviewAgentExecutionResult>;
}

/** Responsibilities: _review-agent lifecycle hook execution_. **/
export interface ReviewAgentHooksContract {
	run(event: ReviewAgentHookEvent): HookDecision;
}

/** Responsibilities: _agent review stop-attempt lifecycle_. **/
export interface ReviewStopSequenceContract {
	begin(): void;
	feedback(): string;
}

/** Responsibilities: _stage-specific request context_. **/
export type ReviewAgentStageRequestContext = {
	readonly root: string;
	readonly review_root: string;
	readonly instruction: string;
	readonly hook_file: string;
	readonly hook_command: string;
	readonly stage: ReviewStageDefinition;
	readonly selection: ReviewAgentName;
	readonly review_start_ms: number;
};

/** Responsibilities: _stage execution collaborators_. **/
export type ReviewAgentStageCollaborators = {
	readonly boundary_failures: SystemFailureClassificationContract;
	readonly review_documents: ReviewAgentFilesContract;
	readonly stage_documents: ReviewAgentFilesContract;
	readonly debug_log: ReviewAgentDebugLogContract;
	readonly agent_catalog: ReviewAgentCatalogContract;
	readonly hooks: ReviewAgentHooksContract;
	readonly file_io: IOContract;
	readonly dialogue: ReviewAgentDialogueContract;
};

/** Responsibilities: _parallel review stage execution_. **/
export type TaskReviewAgentStageExecutionOptions = {
	readonly request_context: ReviewAgentStageRequestContext;
	readonly review_cleanup: boolean;
	readonly collaborators: ReviewAgentStageCollaborators;
};

/** Responsibilities: _parallel review-stage actions_. **/
export interface TaskReviewAgentStageExecutionContract {
	request(open_review_files: readonly string[], review_phase: ReviewAgentPhase, prompt: string): ReviewAgentRequest;
	run(): Promise<TaskReviewRunResult>;
}

/** Responsibilities: _recovery owner liveness_, _recovery claim lifecycle_. **/
export interface ReviewRecoveryClaimContract {
	owner_is_live(path: string): boolean;
	claim(): boolean;
	release(): void;
}

/** Responsibilities: _abandoned agent termination_. **/
export interface ReviewAbandonedAgentCleanupContract {
	terminate(lock_path: string): boolean;
}

/** Responsibilities: _agent tool authorization_. **/
export interface AgentHookToolPolicyContract {
	decision(): HookDecision;
}

export type AgentHookToolPolicyOptions = {
	payload: HookPayload;
	read_tools: ReadonlySet<string>;
	path_policy: ReviewPathPolicyContract;
	mutation_policy: ReviewMutationPolicyContract;
	deletion_policy: ReviewDeletionPolicyContract;
	read_policy: ReviewReadPolicyContract;
	mutation_scope: ReviewStageMutationScopeContract;
};

/** Responsibilities: _review document lifecycle_. **/
export interface ReviewAgentFilesContract {
	review_notes(): string[];
	current_review_notes(): string[];
	size_feedback(): string[];
	reset(): void;
	write_failure(message: string): void;
	write_completion(identity: string): void;
}

/** Responsibilities: _review-agent debug records_. **/
export interface ReviewAgentDebugLogContract {
	clear(): void;
	append(dialogue: string, request: ReviewAgentRequest, execution: ReviewAgentExecutionResult): void;
}

/** Responsibilities: _review-agent lifecycle execution_. **/
export interface ReviewAgentExecutionContract {
	run_dialogue_async(execution: ReviewAgentDialogueExecution): Promise<ReviewAgentExecutionResult>;
}

/** Responsibilities: _review mutation authorization_. **/
export type ReviewWriteRequest = {
	readonly file_path: string;
	readonly fallback_path: string;
	readonly cwd: string;
};

/** Responsibilities: _review patch authorization input_. **/
export type ReviewPatchRequest = {
	readonly input: HookToolInput;
	readonly cwd: string;
	readonly cleanup: boolean;
};

/** Responsibilities: _review file policy_, _patch policy_. **/
export interface ReviewMutationPolicyContract {
	write_decision(request: ReviewWriteRequest): HookDecision;
	patch_decision(request: ReviewPatchRequest): HookDecision;
}

/** Responsibilities: _review file rules_. **/
export interface ReviewDeletionPolicyContract {
	file(path: string, cwd: string): ReviewFilePolicyContract;
	deletion_decision(): HookDecision;
}

/** Responsibilities: _single review artifact authorization_. **/
export interface ReviewFilePolicyContract {
	allows_write(): boolean;
	open_for_mutation(): boolean;
	allows_patch_deletion(cleanup: boolean): boolean;
}

/** Responsibilities: _review access policy_. **/
export interface ReviewReadPolicyContract {
	command_working_directory(workdir: string): string;
	allows_read_command(command: string, words: readonly string[], command_cwd: string): boolean;
	read_only(command: string, cwd: string, command_cwd: string): boolean;
	decision(command: string, cwd: string, command_cwd: string): HookDecision;
}

/** Responsibilities: _command safety classification_. **/
export interface CommandPolicyContract {
	supported(command: string): boolean;
	arguments_safe(words: readonly string[]): boolean;
}

/** Responsibilities: _safe command-option classification_. **/
export interface CommandOptionPolicyContract {
	generic_arguments_safe(words: readonly string[], command_name: string): boolean;
	special_arguments_safe(words: readonly string[], command_name: string): boolean;
}

/** Responsibilities: _review completion identity_. **/

/** Responsibilities: _review dialogue execution_. **/
export interface ReviewAgentDialogueContract {
	initial_async(): Promise<ReviewAgentExecutionResult>;
	cleanup_dialogue_async(request: ReviewAgentRequest): Promise<ReviewAgentExecutionResult>;
}

/** Responsibilities: _review source identity value_, _review source identity comparison_. **/
export interface ReviewStateIdentityContract {
	value(): string;
	matches(expected: string): boolean;
}
