import { join } from "node:path";
import { REVIEW_FINDING_TARGET } from "src/constants";
import { MarkdownTemplate } from "src/core/support/task/markdown_template";
import {
	AGENT_DOCUMENT_DIRECTORY,
	APPLY_PATCH_TOOL_NAME,
	HOOK_AGENT_OUTPUT,
	HOOK_AGENT_START,
	HOOK_AGENT_STOP,
	HOOK_POST_TOOL_USE,
	HOOK_PRE_TOOL_USE,
	HOOK_SESSION_START,
	HOOK_STOP,
	ON_REVIEW_DOCUMENT,
	WRITE_TOOL_NAME,
} from "src/core/support/task/review-agent/constants";
import { AgentHookToolPolicy } from "src/core/support/task/review-agent/policy/agent_hook_tool_policy";
import { ReviewDeletionPolicy } from "src/core/support/task/review-agent/policy/review_deletion_policy";
import { ReviewMutationPolicy } from "src/core/support/task/review-agent/policy/review_mutation_policy";
import { ReviewPathPolicy } from "src/core/support/task/review-agent/policy/review_path_policy";
import { ReviewReadPolicy } from "src/core/support/task/review-agent/policy/review_read_policy";
import { ReviewStageMutationScope } from "src/core/support/task/review-agent/policy/review_stage_mutation_scope";
import type {
	AgentHookToolPolicyContract,
	MarkdownTemplateContract,
} from "src/core/support/task/review-agent/protocols";
import { ReviewFindingVerifier } from "src/core/support/task/review-agent/review_finding_verifier";
import type {
	HookResponseRequest,
	HookReviewProgressContext,
	HookReviewWriteContext,
	ReviewStopContext,
} from "src/core/support/task/review-agent/types";
import type { IOContract } from "src/io/protocols";
import type { HookDecision, HookPayload } from "src/model_types";

/** Responsibilities: _agent hook policy_, _native hook response_. **/
export class AgentHookApplication {
	private readonly _hook_events: Set<string>;
	private readonly _progress_templates: Map<string, MarkdownTemplateContract>;
	private readonly _finding_verifier: ReviewFindingVerifier;
	private readonly _io: IOContract;
	private readonly _installation_root: string;

	/** Responsibilities: _request-scoped tool policy_. **/
	private create_tool_policy(payload: HookPayload): AgentHookToolPolicyContract {
		const path_policy = new ReviewPathPolicy(this._io, payload.cwd);
		const read_policy = new ReviewReadPolicy(path_policy);
		const mutation_scope = new ReviewStageMutationScope(path_policy, payload, this._io);
		const deletion_policy = new ReviewDeletionPolicy(
			payload,
			path_policy,
			this._io,
			read_policy.command_working_directory(payload.tool_input.workdir),
		);
		const mutation_policy = new ReviewMutationPolicy(path_policy, deletion_policy);
		return new AgentHookToolPolicy({
			payload,
			read_tools: new Set(["Read", "Glob", "Grep", "LS"]),
			path_policy,
			mutation_policy,
			deletion_policy,
			read_policy,
			mutation_scope,
		});
	}

	/** Responsibilities: _review progress template access_. **/
	private progress_template(installation_root: string): MarkdownTemplateContract {
		const existing = this._progress_templates.get(installation_root);
		if (existing !== undefined) {
			return existing;
		}
		const created = new MarkdownTemplate(
			join(installation_root, "docs", AGENT_DOCUMENT_DIRECTORY, ON_REVIEW_DOCUMENT),
			this._io,
		);
		this._progress_templates.set(installation_root, created);
		return created;
	}

	/** Responsibilities: _hook event resolution_. **/
	private event_name(event: string, hook_event_name: string): string {
		if (event.length > 0) {
			return event;
		}
		return hook_event_name;
	}

	/** Responsibilities: _review progress text_. **/
	private progress_text(request: HookReviewProgressContext): string {
		const found = this._finding_verifier.paths(request.cwd, request.review_prefix, request.review_start_ms).length;
		const remaining = Math.max(0, REVIEW_FINDING_TARGET - found);
		const template = this.progress_template(this._installation_root);
		return template.render("{N}", String(remaining));
	}

	/** Responsibilities: _allowed hook response_. **/
	private allowed_response(review: HookReviewWriteContext): string {
		const write_event = review.hook_event_name === HOOK_POST_TOOL_USE;
		const review_write = review.tool_name === WRITE_TOOL_NAME || review.tool_name === APPLY_PATCH_TOOL_NAME;
		if (!write_event || !review_write) {
			return "";
		}
		const progress = this.progress_text(review);
		const write_feedback = this._finding_verifier.write_feedback(review);
		let additional_context = progress;
		if (write_feedback.length > 0) {
			additional_context = `${progress}\n\n${write_feedback}`;
		}
		return JSON.stringify({
			hookSpecificOutput: {
				hookEventName: review.hook_event_name,
				additionalContext: additional_context,
			},
		});
	}

	/** Responsibilities: _denied hook response_. **/
	private denied_response(hook_event_name: string, decision: HookDecision): string {
		if (hook_event_name === HOOK_PRE_TOOL_USE) {
			return JSON.stringify({
				hookSpecificOutput: {
					hookEventName: hook_event_name,
					permissionDecision: "deny",
					permissionDecisionReason: decision.reason,
				},
			});
		}
		if (hook_event_name === HOOK_STOP) {
			return JSON.stringify({ decision: "block", reason: decision.reason });
		}
		return JSON.stringify({ continue: false, stopReason: decision.reason });
	}

	/** Responsibilities: _review hook event decision_. **/
	private event_decision(context: ReviewStopContext): HookDecision {
		const feedback = this._finding_verifier.review_feedback(context);
		if (feedback.length > 0) {
			return {
				allowed: false,
				reason: feedback,
			};
		}
		return { allowed: true, reason: "" };
	}

	/** Responsibilities: _agent hook policy initialization_. **/
	public constructor(io: IOContract, installation_root: string) {
		this._io = io;
		this._installation_root = installation_root;
		this._finding_verifier = new ReviewFindingVerifier(io);
		this._hook_events = new Set([
			HOOK_PRE_TOOL_USE,
			HOOK_POST_TOOL_USE,
			HOOK_SESSION_START,
			HOOK_STOP,
			HOOK_AGENT_START,
			HOOK_AGENT_OUTPUT,
			HOOK_AGENT_STOP,
		]);
		this._progress_templates = new Map<string, MarkdownTemplateContract>();
	}

	/** Responsibilities: _native response rendering_. **/
	public response(request: HookResponseRequest): string {
		const payload = request.payload;
		const decision = request.decision;
		if (decision.allowed) {
			return this.allowed_response({
				hook_event_name: payload.hook_event_name,
				tool_name: payload.tool_name,
				cwd: payload.cwd,
				review_prefix: payload.review_prefix,
				review_start_ms: payload.review_start_ms,
				file_path: payload.tool_input.file_path,
				path: payload.tool_input.path,
				command: payload.tool_input.command,
				patch: payload.tool_input.patch,
			});
		}
		return this.denied_response(payload.hook_event_name, decision);
	}

	/** Responsibilities: _hook event policy_. **/
	public decision(payload: HookPayload): HookDecision {
		const event = this.event_name(payload.event, payload.hook_event_name);
		if (!this._hook_events.has(event)) {
			return {
				allowed: false,
				reason:
					"Unknown or missing hook event. Allowed: SessionStart, PreToolUse, PostToolUse, Stop, agent_start, agent_output, and agent_stop.",
			};
		}
		if (event === HOOK_PRE_TOOL_USE) {
			return this.create_tool_policy(payload).decision();
		}
		return this.event_decision({
			event,
			cwd: payload.cwd,
			review_prefix: payload.review_prefix,
			review_start_ms: payload.review_start_ms,
			stop_hook_active: payload.stop_hook_active,
		});
	}
}
