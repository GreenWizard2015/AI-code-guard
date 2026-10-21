import type { HookDecision, HookPayload, HookToolInput } from "src/model/types/types";
import type { SystemFailureClassificationContract } from "src/analysis_protocols";
import type {
	ReviewAgentExecutionResult,
	ReviewAgentHookEventContract,
	ReviewAgentName,
	ReviewAgentProcessResult,
	ReviewAgentCleanupRequest,
	ReviewAgentRequest,
	ReviewAgentPromptRequest,
	ReviewAgentRunRequest,
	ReviewAgentSelection,
} from "src/types";

/** Responsibilities: _Markdown template source_, _Markdown placeholder rendering_. **/
export interface MarkdownTemplateContract {
	placeholders(): readonly string[];
	render(placeholder: string, value: string): string;
	render_all(values: ReadonlyMap<string, string>): string;
	render_text(content: string, values: ReadonlyMap<string, string>): string;
}

/** Responsibilities: _review path policy contract_. **/
export interface ReviewPathPolicyContract {
	allows_file(path: string, cwd: string): boolean;
	allows_read_path(path: string, cwd: string): boolean;
	allows_read_command(command: string, words: readonly string[], cwd: string, command_cwd: string): boolean;
	write_decision(file_path: string, fallback_path: string, cwd: string): HookDecision;
}

/** Responsibilities: _review path containment_, _archive root lookup_. **/
export interface ResolvedReviewPathPolicyContract {
	root(cwd: string): string;
	contains(absolute_path: string, cwd: string): boolean;
	blocks(absolute_path: string, cwd: string, include_ancestors: boolean): boolean;
}

export type ReviewReadCommandContext = {
	command: string;
	words: readonly string[];
	root_cwd: string;
	command_cwd: string;
	recursive: boolean;
};

/** Responsibilities: _review-stage mutation paths_, _review-stage ownership_. **/
export interface ReviewStageMutationScopeContract {
	paths(payload: HookPayload): string[];
	allows(payload: HookPayload, paths: readonly string[]): boolean;
}

/** Responsibilities: _external review-agent process execution_. **/
export interface ReviewAgentProcessContract {
	available(command: string): boolean;
	run_async(command: string, arguments_list: readonly string[], root: string): Promise<ReviewAgentProcessResult>;
	run_hook(
		command: string,
		hook_file: string,
		event: ReviewAgentHookEventContract,
		root: string,
	): ReviewAgentProcessResult;
}

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
	run(event: ReviewAgentHookEventContract): HookDecision;
}

/** Responsibilities: _recovery owner liveness_, _recovery claim lifecycle_. **/
export interface ReviewRecoveryClaimContract {
	owner_is_live(path: string, failure_classification: SystemFailureClassificationContract): boolean;
	claim(failure_classification: SystemFailureClassificationContract): boolean;
	release(): void;
}

/** Responsibilities: _abandoned agent termination_. **/
export interface ReviewAbandonedAgentCleanupContract {
	terminate(lock_path: string): void;
}

/** Responsibilities: _agent tool authorization_. **/
export interface AgentHookToolPolicyContract {
	permission(payload: HookPayload): HookDecision;
	decision(payload: HookPayload): HookDecision;
}

export type AgentHookToolPolicyOptions = {
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
	initial_dialogue_async(
		selection: ReviewAgentSelection,
		request: ReviewAgentRequest,
		dialogue: string,
	): Promise<ReviewAgentExecutionResult>;
	cleanup_async(selection: ReviewAgentSelection, request: ReviewAgentRequest): Promise<ReviewAgentExecutionResult>;
}

/** Responsibilities: _review mutation authorization_. **/
export interface ReviewMutationPolicyContract {
	write_decision(file_path: string, fallback_path: string, cwd: string): HookDecision;
	patch_decision(input: HookToolInput, cwd: string, cleanup: boolean): HookDecision;
}

/** Responsibilities: _review file rules_. **/
export interface ReviewDeletionPolicyContract {
	allows_write(path: string, cwd: string): boolean;
	open_review_file(path: string, cwd: string): boolean;
	allows_patch_deletion(path: string, cwd: string, cleanup: boolean): boolean;
	deletion_decision(command: string, cwd: string, cleanup: boolean, command_cwd: string): HookDecision;
}

/** Responsibilities: _review access policy_. **/
export interface ReviewReadPolicyContract {
	read_only(command: string, cwd: string, command_cwd: string): boolean;
	decision(command: string, cwd: string, command_cwd: string): HookDecision;
}

/** Responsibilities: _command safety classification_. **/
export interface CommandPolicyContract {
	supported(command: string): boolean;
	arguments_safe(words: readonly string[]): boolean;
}

/** Responsibilities: _review completion identity_. **/

/** Responsibilities: _review dialogue execution_. **/
export interface ReviewAgentDialogueContract {
	initial_retry_async(selection: ReviewAgentSelection): Promise<ReviewAgentExecutionResult>;
	cleanup_dialogue_async(selection: ReviewAgentName, request: ReviewAgentRequest): Promise<ReviewAgentExecutionResult>;
}

/** Responsibilities: _review source identity value_, _review source identity comparison_. **/
export interface ReviewStateIdentityContract {
	value(): string;
	matches(expected: string): boolean;
}
