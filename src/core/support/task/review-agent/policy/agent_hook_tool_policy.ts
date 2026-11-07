import {
	APPLY_PATCH_TOOL_NAME,
	REVIEW_STAGE_MUTATION_REASON,
	WRITE_TOOL_NAME,
} from "src/core/support/task/review-agent/constants";
import type {
	AgentHookToolPolicyContract,
	AgentHookToolPolicyOptions,
	ReviewDeletionPolicyContract,
	ReviewMutationPolicyContract,
	ReviewPathPolicyContract,
	ReviewReadPolicyContract,
	ReviewStageMutationScopeContract,
} from "src/core/support/task/review-agent/protocols";
import type { HookDecision, HookPayload, HookToolInput } from "src/model_types";

/** Responsibilities: _agent tool authorization_, _stage mutation ownership_. **/
export class AgentHookToolPolicy implements AgentHookToolPolicyContract {
	private readonly _payload: HookPayload;
	private readonly _tool_input: HookToolInput;
	private readonly _read_tools: ReadonlySet<string>;
	private readonly _path_policy: ReviewPathPolicyContract;
	private readonly _mutation_policy: ReviewMutationPolicyContract;
	private readonly _deletion_policy: ReviewDeletionPolicyContract;
	private readonly _read_policy: ReviewReadPolicyContract;
	private readonly _mutation_scope: ReviewStageMutationScopeContract;
	private readonly _nested_bash_pattern: RegExp;

	/** Responsibilities: _tool input path_. **/
	private read_tool_path(): string {
		if (this._tool_input.file_path !== "") {
			return this._tool_input.file_path;
		}
		return this._tool_input.path;
	}

	/** Responsibilities: _shell execution context_. **/
	private shell_context_allowed(): boolean {
		if (this._tool_input.login) {
			return false;
		}
		if (this._nested_bash_pattern.test(this._tool_input.command)) {
			return false;
		}
		const shell = this._tool_input.shell;
		if (shell === "") {
			return true;
		}
		return ["/bin/bash", "/usr/bin/bash", "/usr/local/bin/bash", "/sbin/bash", "/usr/sbin/bash"].includes(shell);
	}

	/** Responsibilities: _shell tool authorization_. **/
	private bash_decision(): HookDecision {
		if (!this.shell_context_allowed()) {
			return { allowed: false, reason: "Only non-login Bash execution inside the project root is allowed." };
		}
		const command_cwd = this._read_policy.command_working_directory(this._tool_input.workdir);
		if (command_cwd === "" && this._tool_input.command.trim() !== "pwd") {
			return { allowed: false, reason: "Command workdir must remain inside the project root." };
		}
		if (this._read_policy.read_only(this._tool_input.command, this._payload.cwd, command_cwd)) {
			return this._read_policy.decision(this._tool_input.command, this._payload.cwd, command_cwd);
		}
		if (!this._mutation_scope.allows(this._mutation_scope.paths())) {
			return { allowed: false, reason: REVIEW_STAGE_MUTATION_REASON };
		}
		return this._deletion_policy.deletion_decision();
	}

	/** Responsibilities: _mutation authorization_. **/
	private mutation_decision(): HookDecision {
		if (!this._mutation_scope.allows(this._mutation_scope.paths())) {
			return { allowed: false, reason: REVIEW_STAGE_MUTATION_REASON };
		}
		if (this._payload.tool_name === APPLY_PATCH_TOOL_NAME) {
			return this._mutation_policy.patch_decision({
				input: this._tool_input,
				cwd: this._payload.cwd,
				cleanup: this._payload.review_phase === "cleanup",
			});
		}
		if (this._payload.tool_name === WRITE_TOOL_NAME) {
			return this._mutation_policy.write_decision({
				file_path: this._tool_input.file_path,
				fallback_path: this._tool_input.path,
				cwd: this._payload.cwd,
			});
		}
		return {
			allowed: false,
			reason: `Tool ${this._payload.tool_name} is not allowed during architecture review. Allowed: Read, Glob, Grep, LS, safe read-only Bash, and review-directory Markdown writes.`,
		};
	}

	/** Responsibilities: _tool permission_. **/
	private permission(): HookDecision {
		let path = this.read_tool_path();
		if (path === "" && ["Glob", "Grep", "LS"].includes(this._payload.tool_name)) {
			path = this._payload.cwd;
		}
		if (!this._path_policy.allows_read_path(path)) {
			return {
				allowed: false,
				reason:
					"Read tools may access only paths inside the project root. Allowed: Read, Glob, Grep, or LS for project files.",
			};
		}
		return { allowed: true, reason: "" };
	}

	/** Responsibilities: _agent tool policy_. **/
	public constructor(options: AgentHookToolPolicyOptions) {
		this._payload = options.payload;
		this._tool_input = options.payload.tool_input;
		this._read_tools = options.read_tools;
		this._path_policy = options.path_policy;
		this._mutation_policy = options.mutation_policy;
		this._deletion_policy = options.deletion_policy;
		this._read_policy = options.read_policy;
		this._mutation_scope = options.mutation_scope;
		this._nested_bash_pattern = /(?:^|\s)(?:\/bin\/|\/usr\/bin\/)?bash\s+-[A-Za-z]*c(?:\s|$)/u;
	}

	/** Responsibilities: _tool policy decision_. **/
	public decision(): HookDecision {
		if (this._read_tools.has(this._payload.tool_name)) {
			return this.permission();
		}
		if (this._payload.tool_name === "Bash") {
			return this.bash_decision();
		}
		return this.mutation_decision();
	}
}
