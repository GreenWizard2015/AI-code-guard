import { basename, resolve } from "node:path";
import { APPLY_PATCH_TOOL_NAME, WRITE_TOOL_NAME } from "src/core/support/task/review-agent/constants";
import type {
	ReviewPathPolicyContract,
	ReviewStageMutationScopeContract,
} from "src/core/support/task/review-agent/protocols";
import type { IOContract } from "src/io/protocols";
import type { HookPayload, HookToolInput } from "src/model_types";

/** Responsibilities: _review-stage mutation paths_, _review-stage ownership_. **/
export class ReviewStageMutationScope implements ReviewStageMutationScopeContract {
	private readonly _paths_policy: ReviewPathPolicyContract;
	private readonly _file_io: IOContract;
	private readonly _payload: HookPayload;
	private readonly _tool_input: HookToolInput;

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
	private bash_paths(): string[] {
		let workdir = "";
		if (this._tool_input.workdir.length > 0) {
			workdir = this._tool_input.workdir;
		}
		let command_cwd = this._payload.cwd;
		if (workdir.length > 0) {
			command_cwd = resolve(this._payload.cwd, workdir);
		}
		return this.command_paths(this.command_body(this._tool_input.command), command_cwd);
	}

	/** Responsibilities: _mutation paths_. **/
	private write_paths(): string[] {
		if (this._tool_input.file_path.length > 0) {
			return [this._tool_input.file_path];
		}
		return [this._tool_input.path];
	}

	/** Responsibilities: _review file creation time_. **/
	private created_during_review(path: string): boolean {
		const file = this._file_io.file(resolve(this._payload.cwd, path));
		if (!file.path_exists()) {
			return true;
		}
		return file.metadata().mtime_ms > this._payload.review_start_ms;
	}

	/** Responsibilities: _review path ownership_. **/
	private allows_path(path: string): boolean {
		if (!this._paths_policy.allows_file(path)) {
			return false;
		}
		if (!this.created_during_review(path)) {
			return false;
		}
		return basename(resolve(this._payload.cwd, path)).startsWith(this._payload.review_prefix);
	}

	/** Responsibilities: _mutation scope initialization_. **/
	public constructor(paths_policy: ReviewPathPolicyContract, payload: HookPayload, file_io: IOContract) {
		this._paths_policy = paths_policy;
		this._payload = payload;
		this._tool_input = payload.tool_input;
		this._file_io = file_io;
	}

	/** Responsibilities: _tool mutation path extraction_. **/
	public paths(): string[] {
		if (this._payload.tool_name === APPLY_PATCH_TOOL_NAME) {
			let patch = this._tool_input.patch;
			if (patch.length === 0) {
				patch = this._tool_input.command;
			}
			return this.patch_paths(patch);
		}
		if (this._payload.tool_name === "Bash") {
			return this.bash_paths();
		}
		if (this._payload.tool_name === WRITE_TOOL_NAME) {
			return this.write_paths();
		}
		return [];
	}

	/** Responsibilities: _review-stage ownership check_. **/
	public allows(paths: readonly string[]): boolean {
		if (paths.length === 0) {
			return true;
		}
		if (this._payload.review_prefix.length === 0) {
			return false;
		}
		for (const path of paths) {
			if (!this.allows_path(path)) {
				return false;
			}
		}
		return true;
	}
}
