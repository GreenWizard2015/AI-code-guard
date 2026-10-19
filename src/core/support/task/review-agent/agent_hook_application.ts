import { join, resolve } from "node:path";
import { MarkdownTemplate } from "src/core/support/task/markdown_template";
import {
	AGENT_DOCUMENT_DIRECTORY,
	AI_CODE_GUARD_DIRECTORY,
	APPLY_PATCH_TOOL_NAME,
	HOOK_AGENT_OUTPUT,
	HOOK_AGENT_START,
	HOOK_AGENT_STOP,
	HOOK_POST_TOOL_USE,
	HOOK_PRE_TOOL_USE,
	HOOK_SESSION_START,
	HOOK_STOP,
	ON_REVIEW_DOCUMENT,
	REVIEW_COMPLETION_FILE,
	REVIEW_DIRECTORY,
	REVIEW_FAILURE_FILE,
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
	ReviewPathPolicyContract,
} from "src/core/support/task/review-agent/protocols";
import { MAX_REVIEW_LINES, REPORTING_PROJECT_ROOT, REVIEW_FINDING_TARGET } from "src/constants";
import type { HookDecision, HookPayload } from "src/model/types/types";
import type { FileEntryContract, IOContract } from "src/io/protocols";

/** Responsibilities: _agent hook policy_, _native hook response_. **/
export class AgentHookApplication {
	private readonly hook_events: Set<string>;
	private readonly path_policy: ReviewPathPolicyContract;
	private readonly tool_policy: AgentHookToolPolicyContract;
	private readonly progress_templates: Map<string, MarkdownTemplateContract>;
	private readonly io: IOContract;

	/** Responsibilities: _review progress template access_. **/
	private progress_template(root: string): MarkdownTemplateContract {
		const existing = this.progress_templates.get(root);
		if (existing !== undefined) {
			return existing;
		}
		void root;
		const created = new MarkdownTemplate(
			join(REPORTING_PROJECT_ROOT, "docs", AGENT_DOCUMENT_DIRECTORY, ON_REVIEW_DOCUMENT),
			this.io,
		);
		this.progress_templates.set(root, created);
		return created;
	}

	/** Responsibilities: _hook event resolution_. **/
	private event_name(payload: HookPayload): string {
		if (typeof payload.event === "string") {
			if (payload.event.length > 0) {
				return payload.event;
			}
		}
		return payload.hook_event_name;
	}

	/** Responsibilities: _review file inventory_. **/
	private is_review_file(entry: FileEntryContract, review_prefix: string): boolean {
		if (!entry.is_file) {
			return false;
		}
		if (!entry.name.endsWith(".md")) {
			return false;
		}
		const is_status_file = entry.name === REVIEW_COMPLETION_FILE || entry.name === REVIEW_FAILURE_FILE;
		return !is_status_file && entry.name.startsWith(review_prefix);
	}

	/** Responsibilities: _review file inventory_. **/
	private review_file_count(root: string, review_prefix: string): number {
		const review_root = join(root, AI_CODE_GUARD_DIRECTORY, REVIEW_DIRECTORY);
		if (!this.io.file_paths.path_exists(review_root)) {
			return 0;
		}
		return this.io.directory_entries
			.list_entries(review_root)
			.filter((entry) => this.is_review_file(entry, review_prefix)).length;
	}

	/** Responsibilities: _review path_. **/
	private review_write_path(payload: HookPayload): string {
		let path = payload.tool_input.file_path;
		if (path === "") {
			path = payload.tool_input.path;
		}
		if (path === "") {
			return "";
		}
		if (!this.path_policy.allows_file(path, payload.cwd)) {
			return "";
		}
		return resolve(payload.cwd, path);
	}

	/** Responsibilities: _oversized review guidance_. **/
	private review_size_instruction(payload: HookPayload): string {
		const file = this.review_write_path(payload);
		if (!this.io.file_paths.path_exists(file)) {
			return "";
		}
		const lines = this.io.file_content.file_text(file).trimEnd().split(/\r?\n/u).length;
		if (lines <= MAX_REVIEW_LINES) {
			return "";
		}
		return [
			`Review file ${file} has ${lines} lines and exceeds the ${MAX_REVIEW_LINES}-line limit.`,
			`Split it in the review directory into focused review files of at most ${MAX_REVIEW_LINES} lines.`,
			"Keep every confirmed finding, then mark the original oversized file Status: Resolved.",
		].join(" ");
	}

	/** Responsibilities: _allowed hook response_. **/
	private review_context(payload: HookPayload, progress: string): string {
		const size_instruction = this.review_size_instruction(payload);
		if (size_instruction.length === 0) {
			return progress;
		}
		return `${progress}\n\n${size_instruction}`;
	}

	/** Responsibilities: _allowed hook response_. **/
	private allowed_response(payload: HookPayload): string {
		const write_event = payload.hook_event_name === HOOK_POST_TOOL_USE;
		const review_write = payload.tool_name === WRITE_TOOL_NAME || payload.tool_name === APPLY_PATCH_TOOL_NAME;
		if (!write_event || !review_write) {
			return "";
		}
		const progress = this.progress_template(payload.cwd).render(
			"{N}",
			String(Math.max(0, REVIEW_FINDING_TARGET - this.review_file_count(payload.cwd, payload.review_prefix))),
		);
		const additional_context = this.review_context(payload, progress);
		return JSON.stringify({
			hookSpecificOutput: {
				hookEventName: payload.hook_event_name,
				additionalContext: additional_context,
			},
		});
	}

	/** Responsibilities: _denied hook response_. **/
	private denied_response(payload: HookPayload, decision: HookDecision): string {
		if (payload.hook_event_name === HOOK_PRE_TOOL_USE) {
			return JSON.stringify({
				hookSpecificOutput: {
					hookEventName: payload.hook_event_name,
					permissionDecision: "deny",
					permissionDecisionReason: decision.reason,
				},
			});
		}
		return JSON.stringify({ continue: false, stopReason: decision.reason });
	}

	/** Responsibilities: _agent hook policy initialization_. **/
	public constructor(io: IOContract) {
		this.io = io;
		this.hook_events = new Set([
			HOOK_PRE_TOOL_USE,
			HOOK_POST_TOOL_USE,
			HOOK_SESSION_START,
			HOOK_STOP,
			HOOK_AGENT_START,
			HOOK_AGENT_OUTPUT,
			HOOK_AGENT_STOP,
		]);
		this.progress_templates = new Map<string, MarkdownTemplateContract>();
		const path_policy = new ReviewPathPolicy(io);
		const mutation_scope = new ReviewStageMutationScope(path_policy);
		const deletion_policy = new ReviewDeletionPolicy(path_policy, io);
		const mutation_policy = new ReviewMutationPolicy(path_policy, deletion_policy);
		const read_policy = new ReviewReadPolicy(path_policy);
		this.path_policy = path_policy;
		this.tool_policy = new AgentHookToolPolicy({
			read_tools: new Set(["Read", "Glob", "Grep", "LS"]),
			path_policy,
			mutation_policy,
			deletion_policy,
			read_policy,
			mutation_scope,
		});
	}

	/** Responsibilities: _native response rendering_. **/
	public response(payload: HookPayload, decision: HookDecision): string {
		if (decision.allowed) {
			return this.allowed_response(payload);
		}
		return this.denied_response(payload, decision);
	}

	/** Responsibilities: _hook event policy_. **/
	public decision(payload: HookPayload): HookDecision {
		const event = this.event_name(payload);
		if (!this.hook_events.has(event)) {
			return {
				allowed: false,
				reason:
					"Unknown or missing hook event. Allowed: SessionStart, PreToolUse, PostToolUse, Stop, agent_start, agent_output, and agent_stop.",
			};
		}
		if (event === HOOK_PRE_TOOL_USE) {
			return this.tool_policy.decision(payload);
		}
		return { allowed: true, reason: "" };
	}
}
