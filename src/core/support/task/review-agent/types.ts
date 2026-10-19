import type {
	ReviewAgentCatalogContract,
	ReviewAgentDebugLogContract,
	ReviewAgentFilesContract,
	ReviewAgentHooksContract,
} from "src/core/support/task/review-agent/protocols";
import type { ReviewAgentProcessResult } from "src/types";
import type { IOContract } from "src/io/protocols";

export type ReviewAgentExecutionOptions = {
	root: string;
	review_root: string;
	hook_file: string;
	review_stage: string;
	review_prefix: string;
	debug_log: ReviewAgentDebugLogContract;
	agent_catalog: ReviewAgentCatalogContract;
	hooks: ReviewAgentHooksContract;
};
export type TaskReviewAgentOptions = {
	root: string;
	agent_catalog: ReviewAgentCatalogContract;
	hooks: ReviewAgentHooksContract;
	hook_command: string;
	hook_file: string;
	file_io: IOContract;
};
export type ReviewAgentAsyncOutput = { stdout: string; stderr: string };
export type ReviewAgentOutputStream = "stdout" | "stderr";
/** Responsibilities: _process identity comparison_, _identity persistence_. **/
export interface ReviewAgentIdentityContract {
	from_process(pid: number): ReviewAgentIdentityContract;
	serialized(): string;
	matches(other: ReviewAgentIdentityContract): boolean;
	persist(root: string): void;
}
export type ReviewAgentProbeResult = { failed: boolean; status: number };
export type ReviewAgentResultResolver = (result: ReviewAgentProcessResult) => void;
export type ReviewAgentEscalationCallback = () => void;
export type ReviewAgentCloseState = {
	state: ReviewAgentProcessStateContract;
	timed_out: boolean;
	escalation_finished: boolean;
	process_closed: boolean;
	closed_exit_code: number;
};
/** Responsibilities: _review-agent process state transitions_. **/
export interface ReviewAgentProcessStateContract {
	timed_out_state(): ReviewAgentProcessStateContract;
	error_state(message: string): ReviewAgentProcessStateContract;
	escalation_state(timer: ReturnType<typeof setTimeout>): ReviewAgentProcessStateContract;
	complete(exit_code: number): void;
}
export type ReviewHookPhase = "cleanup" | "initial";
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
	tool_name: string;
	tool_input: RawHookToolInput;
	cwd: string;
	review_stage: string;
	review_prefix: string;
	review_phase: string;
};
type ReviewAgentDialogueExecutionOptions = {
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
};
type ReviewAgentDialogueCollaborators = {
	review_documents: ReviewAgentFilesContract;
	debug_log: ReviewAgentDebugLogContract;
	agent_catalog: ReviewAgentCatalogContract;
	hooks: ReviewAgentHooksContract;
	io: IOContract;
};
export type ReviewAgentDialogueOptions = {
	execution: ReviewAgentDialogueExecutionOptions;
	stage: ReviewAgentDialogueStageOptions;
	collaborators: ReviewAgentDialogueCollaborators;
};
