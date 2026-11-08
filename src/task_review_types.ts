export type CodexReviewAgentName = "codex" | "cx" | "cxa";
export type ReviewAgentName = CodexReviewAgentName | "claude";
export type ReviewAgentSelection = ReviewAgentName | "none";
export type ReviewStageDefinition = { id: string; prefix: string; focus: string; document: string };
export type ReviewAgentStageRunRequest = {
	selection: ReviewAgentName;
	stage: ReviewStageDefinition;
	review_start_ms: number;
};
export type ReviewAgentStageBatchRequest = {
	selection: ReviewAgentName;
	stages: readonly ReviewStageDefinition[];
	review_start_ms: number;
};
export type ReviewAgentPreparedRun = {
	identity: string;
	stages: readonly ReviewStageDefinition[];
	review_start_ms: number;
};
export type ReviewAgentHookConfiguration = {
	hook_file: string;
	hook_command: string;
	review_prefix: string;
	review_start_ms: number;
};
export type ReviewAgentRequest = {
	root: string;
	instruction: string;
	review_root: string;
	hook: ReviewAgentHookConfiguration;
	review_stage: string;
	review_stage_plan: string;
	open_review_files: readonly string[];
	prompt: string;
};
/** Responsibilities: _review prompt value contract_. **/
export type ReviewAgentPromptValues = {
	readonly root: string;
	readonly instruction: string;
	readonly review_prefix: string;
	readonly review_root: string;
};
export type ReviewAgentDialogueExecution = {
	request: ReviewAgentRequest;
	dialogue: string;
};
export type ReviewAgentPromptRequest = { prompt_request: ReviewAgentRequest };
export type ReviewAgentRunRequest = { run_request: ReviewAgentRequest };
/** Responsibilities: _review agent process outcome_. **/
export type ReviewAgentProcessResult = {
	readonly exit_code: number;
	readonly stdout: string;
	readonly stderr: string;
};
export type ReviewAgentHookEventName = string;
export type ReviewAgentHookEventContext = {
	event: ReviewAgentHookEventName;
	provider: ReviewAgentSelection;
	root: string;
	review_root: string;
	hook_file: string;
	review_stage: string;
	review_prefix: string;
	review_start_ms: number;
};
export type ReviewAgentHookTool = { name: string; input: string };
/** Responsibilities: _review-agent hook event transport_. **/
export type ReviewAgentHookEvent = {
	context: ReviewAgentHookEventContext;
	tool: ReviewAgentHookTool;
	result: ReviewAgentProcessResult;
};
export type TaskReviewRunResult = { provider: ReviewAgentName | "none"; message: string };
export type ReviewAgentExecutionResult = {
	provider: ReviewAgentName | "none";
	process: ReviewAgentProcessResult;
	no_issues: boolean;
	message: string;
};
