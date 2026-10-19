import { basename, resolve } from "node:path";
import type { HookPayload } from "src/model/types/types";
import type {
	ReviewPathPolicyContract,
	ReviewStageMutationScopeContract,
} from "src/core/support/task/review-agent/protocols";
import { APPLY_PATCH_TOOL_NAME, WRITE_TOOL_NAME } from "src/core/support/task/review-agent/constants";

/** Responsibilities: _review-stage mutation paths_, _review-stage ownership_. **/
export class ReviewStageMutationScope implements ReviewStageMutationScopeContract {
	private readonly paths_policy: ReviewPathPolicyContract;

	/** Responsibilities: _outer shell quote removal_. **/
	private quoted_body(body: string): string {
		if (body.startsWith("'") && body.endsWith("'")) {
			return body.slice(1, -1);
		}
		if (body.startsWith('"') && body.endsWith('"')) {
			return body.slice(1, -1);
		}
		return body;
	}

	/** Responsibilities: _Bash login-command unwrapping_. **/
	private command_body(command: string): string {
		const trimmed = command.trim();
		const match = trimmed.match(/^(?:\/(?:usr\/)?bin\/)?bash\s+-lc\s+([\s\S]+)$/u);
		if (match === null) {
			return trimmed;
		}
		const wrapped = match[1];
		if (wrapped === undefined) {
			return "";
		}
		const body = wrapped.trim();
		if (body.length < 2) {
			return body;
		}
		return this.quoted_body(body);
	}

	/** Responsibilities: _shell mutation paths_. **/
	private command_paths(command: string, command_cwd: string): string[] {
		const paths: string[] = [];
		let command_name = true;
		for (const word of command.trim().split(/\s+/u)) {
			if (word.length === 0) {
				continue;
			}
			if (command_name) {
				command_name = false;
				continue;
			}
			if (word.startsWith("-")) {
				continue;
			}
			paths.push(resolve(command_cwd, word));
		}
		return paths;
	}

	/** Responsibilities: _patch mutation paths_. **/
	private patch_paths(patch: string): string[] {
		const paths: string[] = [];
		for (const line of patch.split("\n")) {
			if (line.startsWith("*** ") && line.includes("File: ")) {
				paths.push(line.slice(line.indexOf("File: ") + "File: ".length).trim());
			}
		}
		return paths;
	}

	/** Responsibilities: _Bash mutation path extraction_. **/
	private bash_paths(payload: HookPayload): string[] {
		let workdir = "";
		if (payload.tool_input.workdir.length > 0) {
			workdir = payload.tool_input.workdir;
		}
		let command_cwd = payload.cwd;
		if (workdir.length > 0) {
			command_cwd = resolve(payload.cwd, workdir);
		}
		return this.command_paths(this.command_body(payload.tool_input.command), command_cwd);
	}

	/** Responsibilities: _mutation paths_. **/
	private write_paths(payload: HookPayload): string[] {
		if (payload.tool_input.file_path.length > 0) {
			return [payload.tool_input.file_path];
		}
		return [payload.tool_input.path];
	}

	/** Responsibilities: _review-stage mutation policy_. **/
	public constructor(paths_policy: ReviewPathPolicyContract) {
		this.paths_policy = paths_policy;
	}

	/** Responsibilities: _tool mutation path extraction_. **/
	public paths(payload: HookPayload): string[] {
		if (payload.tool_name === APPLY_PATCH_TOOL_NAME) {
			let patch = payload.tool_input.patch;
			if (patch.length === 0) {
				patch = payload.tool_input.command;
			}
			return this.patch_paths(patch);
		}
		if (payload.tool_name === "Bash") {
			return this.bash_paths(payload);
		}
		if (payload.tool_name === WRITE_TOOL_NAME) {
			return this.write_paths(payload);
		}
		return [];
	}

	/** Responsibilities: _review-stage ownership check_. **/
	public allows(payload: HookPayload, paths: readonly string[]): boolean {
		if (paths.length === 0) {
			return true;
		}
		if (payload.review_prefix.length === 0) {
			return false;
		}
		for (const path of paths) {
			if (!this.paths_policy.allows_file(path, payload.cwd)) {
				return false;
			}
			if (!basename(resolve(payload.cwd, path)).startsWith(payload.review_prefix)) {
				return false;
			}
		}
		return true;
	}
}
