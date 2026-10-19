import type { HookDecision, HookPayload } from "src/model/types/types";
import { resolve } from "node:path";
import type {
	ReviewMutationPolicyContract,
	ReviewDeletionPolicyContract,
	AgentHookToolPolicyContract,
	ReviewPathPolicyContract,
	ReviewReadPolicyContract,
	ReviewStageMutationScopeContract,
	AgentHookToolPolicyOptions,
} from "src/core/support/task/review-agent/protocols";
import {
	APPLY_PATCH_TOOL_NAME,
	REVIEW_STAGE_MUTATION_REASON,
	WRITE_TOOL_NAME,
} from "src/core/support/task/review-agent/constants";

/** Responsibilities: _agent tool authorization_, _stage mutation ownership_. **/
export class AgentHookToolPolicy implements AgentHookToolPolicyContract {
	private readonly read_tools: ReadonlySet<string>;
	private readonly path_policy: ReviewPathPolicyContract;
	private readonly mutation_policy: ReviewMutationPolicyContract;
	private readonly deletion_policy: ReviewDeletionPolicyContract;
	private readonly read_policy: ReviewReadPolicyContract;
	private readonly mutation_scope: ReviewStageMutationScopeContract;
	private readonly nested_bash_pattern: RegExp;

	/** Responsibilities: _tool input path_. **/
	private read_tool_path(payload: HookPayload): string {
		if (payload.tool_input.file_path !== "") {
			return payload.tool_input.file_path;
		}
		return payload.tool_input.path;
	}

	/** Responsibilities: _tool command working-directory validation_. **/
	private command_cwd(payload: HookPayload): string {
		const workdir = payload.tool_input.workdir;
		if (workdir === "") {
			return payload.cwd;
		}
		if (!this.path_policy.allows_read_path(workdir, payload.cwd)) {
			return "";
		}
		return resolve(payload.cwd, workdir);
	}

	/** Responsibilities: _shell execution context_. **/
	private shell_context_allowed(payload: HookPayload): boolean {
		if (payload.tool_input.login) {
			return false;
		}
		if (this.nested_bash_pattern.test(payload.tool_input.command)) {
			return false;
		}
		const shell = payload.tool_input.shell;
		if (shell === "") {
			return true;
		}
		return ["/bin/bash", "/usr/bin/bash", "/usr/local/bin/bash", "/sbin/bash", "/usr/sbin/bash"].includes(shell);
	}

	/** Responsibilities: _shell tool authorization_. **/
	private bash_decision(payload: HookPayload): HookDecision {
		if (!this.shell_context_allowed(payload)) {
			return { allowed: false, reason: "Only non-login Bash execution inside the project root is allowed." };
		}
		const command_cwd = this.command_cwd(payload);
		if (command_cwd === "" && payload.tool_input.command.trim() !== "pwd") {
			return { allowed: false, reason: "Command workdir must remain inside the project root." };
		}
		if (this.read_policy.read_only(payload.tool_input.command, payload.cwd, command_cwd)) {
			return this.read_policy.decision(payload.tool_input.command, payload.cwd, command_cwd);
		}
		if (!this.mutation_scope.allows(payload, this.mutation_scope.paths(payload))) {
			return { allowed: false, reason: REVIEW_STAGE_MUTATION_REASON };
		}
		return this.deletion_policy.deletion_decision(
			payload.tool_input.command,
			payload.cwd,
			payload.review_phase === "cleanup",
			command_cwd,
		);
	}

	/** Responsibilities: _mutation authorization_. **/
	private mutation_decision(payload: HookPayload): HookDecision {
		if (!this.mutation_scope.allows(payload, this.mutation_scope.paths(payload))) {
			return { allowed: false, reason: REVIEW_STAGE_MUTATION_REASON };
		}
		if (payload.tool_name === APPLY_PATCH_TOOL_NAME) {
			return this.mutation_policy.patch_decision(payload.tool_input, payload.cwd, payload.review_phase === "cleanup");
		}
		if (payload.tool_name === WRITE_TOOL_NAME) {
			return this.mutation_policy.write_decision(payload.tool_input.file_path, payload.tool_input.path, payload.cwd);
		}
		return {
			allowed: false,
			reason: `Tool ${payload.tool_name} is not allowed during architecture review. Allowed: Read, Glob, Grep, LS, safe read-only Bash, and review-directory Markdown writes.`,
		};
	}

	/** Responsibilities: _agent tool policy_. **/
	public constructor(options: AgentHookToolPolicyOptions) {
		this.read_tools = options.read_tools;
		this.path_policy = options.path_policy;
		this.mutation_policy = options.mutation_policy;
		this.deletion_policy = options.deletion_policy;
		this.read_policy = options.read_policy;
		this.mutation_scope = options.mutation_scope;
		this.nested_bash_pattern = /(?:^|\s)(?:\/bin\/|\/usr\/bin\/)?bash\s+-[A-Za-z]*c(?:\s|$)/u;
	}

	/** Responsibilities: _tool permission_. **/
	public permission(payload: HookPayload): HookDecision {
		let path = this.read_tool_path(payload);
		if (path === "" && ["Glob", "Grep", "LS"].includes(payload.tool_name)) {
			path = payload.cwd;
		}
		if (!this.path_policy.allows_read_path(path, payload.cwd)) {
			return {
				allowed: false,
				reason:
					"Read tools may access only paths inside the project root. Allowed: Read, Glob, Grep, or LS for project files.",
			};
		}
		return { allowed: true, reason: "" };
	}

	/** Responsibilities: _tool policy decision_. **/
	public decision(payload: HookPayload): HookDecision {
		if (this.read_tools.has(payload.tool_name)) {
			return this.permission(payload);
		}
		if (payload.tool_name === "Bash") {
			return this.bash_decision(payload);
		}
		return this.mutation_decision(payload);
	}
}
