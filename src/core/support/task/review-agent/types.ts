import type {
	OwnedProcessGroup,
	ProcessId,
	ProcessSignalContract,
	SystemFailureClassificationContract,
} from "src/analysis_protocols";
import type {
	ReviewAbandonedAgentCleanupContract,
	ReviewAgentCatalogContract,
	ReviewAgentDebugLogContract,
	ReviewAgentFilesContract,
	ReviewAgentHooksContract,
	ReviewRecoveryClaimContract,
} from "src/core/support/task/review-agent/protocols";
import type { ReviewAgentProcessExecution } from "src/core/support/task/review-agent/protocols";
import type { IOContract } from "src/io/protocols";
import type { HookDecision, HookPayload } from "src/model_types";
import type { ReviewAgentName } from "src/task_review_types";
import type { ReviewAgentProcessResult } from "src/task_review_types";
import type { ReviewAgentExecutionResult } from "src/task_review_types";

export type ReviewSizeCorrectionResult = {
	execution: ReviewAgentExecutionResult;
	complete: boolean;
};

export type ReviewFenceState = {
	readonly character: string;
	readonly length: number;
	readonly is_open: boolean;
};

/** Responsibilities: _agent cleanup request data_, _completed process result_. **/
export type ReviewAgentProcessCleanupRequest = {
	execution: ReviewAgentProcessExecution;
	result: ReviewAgentProcessResult;
};

export type ReviewAgentIdentityOptions = {
	pid: number;
	start_time: string;
	boot_id: string;
	available: boolean;
	file_io: IOContract;
	ownership_token: string;
};

export type ReviewRecoveryProcessIdentity = {
	readonly process_id: number;
	readonly start_time: string;
	readonly boot_id: string;
};

export type ReviewRecoveryOwnerRecord = {
	readonly ownership_token: string;
	readonly process_identity: ReviewRecoveryProcessIdentity;
};

export type ReviewRecoveryClaimPublication = {
	readonly staging_path: string;
	readonly target_path: string;
	readonly ownership_token: string;
};

export type ReviewRecoveryOwnerRecordPublication = {
	readonly staging_path: string;
	readonly ownership_token: string;
};

export type ReviewRecoveryClaimOwnerOptions = {
	file_io: IOContract;
	process_signal: ProcessSignalContract;
	failure_classification: SystemFailureClassificationContract;
};

/** Responsibilities: _recovery owner identity serialization_, _process liveness_. **/
export interface ReviewRecoveryClaimOwnerContract {
	owner_live(owner_text: string): boolean;
	publish(request: ReviewRecoveryClaimPublication): boolean;
}

export type HookReviewWriteContext = {
	hook_event_name: string;
	tool_name: string;
	cwd: string;
	review_prefix: string;
	review_start_ms: number;
	file_path: string;
	path: string;
	command: string;
	patch: string;
};
export type HookReviewProgressContext = {
	cwd: string;
	review_prefix: string;
	review_start_ms: number;
};
export type ReviewStopContext = {
	event: string;
	cwd: string;
	review_prefix: string;
	review_start_ms: number;
	stop_hook_active: boolean;
};
export type HookResponseRequest = {
	payload: HookPayload;
	decision: HookDecision;
};

export type ReviewAgentExecutionOptions = {
	selection: ReviewAgentName;
	root: string;
	review_root: string;
	hook_file: string;
	review_stage: string;
	review_prefix: string;
	review_start_ms: number;
	debug_log: ReviewAgentDebugLogContract;
	agent_catalog: ReviewAgentCatalogContract;
	hooks: ReviewAgentHooksContract;
};
export type ReviewRunLockRecoveryOptions = {
	path: string;
	file_io: IOContract;
	failure_classification: SystemFailureClassificationContract;
	recovery_claim: ReviewRecoveryClaimContract;
	abandoned_agents: ReviewAbandonedAgentCleanupContract;
};
export type TaskReviewAgentOptions = {
	root: string;
	agent_catalog: ReviewAgentCatalogContract;
	hooks: ReviewAgentHooksContract;
	hook_command: string;
	hook_file: string;
	file_io: IOContract;
};
export type TaskReviewAgentBatchOptions = {
	execution: ReviewAgentDialogueExecutionOptions;
	collaborators: ReviewAgentBatchCollaborators;
};
export type ReviewAgentBatchCollaborators = {
	boundary_failures: SystemFailureClassificationContract;
	review_documents: ReviewAgentFilesContract;
	debug_log: ReviewAgentDebugLogContract;
	agent_catalog: ReviewAgentCatalogContract;
	hooks: ReviewAgentHooksContract;
	file_io: IOContract;
};
/** Responsibilities: _process identity comparison_, _identity persistence_. **/
export interface ReviewAgentIdentityContract {
	from_process(process_id: ProcessId): ReviewAgentIdentityContract;
	stored_identity(text: string): ReviewAgentIdentityContract;
	serialized(): string;
	owned_process_group(): OwnedProcessGroup;
	matches(other: ReviewAgentIdentityContract): boolean;
	persist(root: string, ownership_token: string): string;
}
export type RawHookToolInput = {
	command: string;
	cmd: string;
	file_path: string;
	path: string;
	patch: string;
	workdir: string;
	shell: string;
	login: boolean;
};
export type RawHookPayload = {
	event: string;
	hook_event_name: string;
	stop_hook_active: boolean;
	tool_name: string;
	tool_input: RawHookToolInput;
	cwd: string;
	review_stage: string;
	review_prefix: string;
};
export type ReviewAgentDialogueExecutionOptions = {
	root: string;
	review_root: string;
	instruction: string;
	hook_file: string;
	hook_command: string;
};
type ReviewAgentDialogueStageOptions = {
	review_stage: string;
	review_prefix: string;
	review_stage_plan: string;
	review_start_ms: number;
};
type ReviewAgentDialogueCollaborators = {
	review_documents: ReviewAgentFilesContract;
	debug_log: ReviewAgentDebugLogContract;
	agent_catalog: ReviewAgentCatalogContract;
	hooks: ReviewAgentHooksContract;
	io: IOContract;
};
export type ReviewAgentDialogueOptions = {
	selection: ReviewAgentName;
	execution: ReviewAgentDialogueExecutionOptions;
	stage: ReviewAgentDialogueStageOptions;
	collaborators: ReviewAgentDialogueCollaborators;
};
