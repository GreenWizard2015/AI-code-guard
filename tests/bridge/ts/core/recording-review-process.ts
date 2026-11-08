import type {
	ReviewAgentHookProcessRequest,
	ReviewAgentProcessContract,
	ReviewAgentProcessRequest,
} from "src/core/support/task/review-agent/protocols";
import type { ReviewAgentHookEvent, ReviewAgentProcessResult } from "src/task_review_types";

/** Responsibilities: _review-agent command recording_, _process fixture output_. **/
export class RecordingProcess implements ReviewAgentProcessContract {
	private _command = "";
	private _arguments_list: readonly string[];
	private _root = "";
	private _hook_command = "";
	private _hook_file = "";
	private _hook_event: ReviewAgentHookEvent;
	private _hook_root = "";
	private _hook_result: ReviewAgentProcessResult;

	/** Responsibilities: _process recording state initialization_. **/
	public constructor() {
		this._arguments_list = [];
		this._hook_event = {
			context: {
				event: "",
				provider: "none",
				root: "",
				review_root: "",
				hook_file: "",
				review_stage: "",
				review_prefix: "",
				review_start_ms: 0,
			},
			tool: { name: "", input: "" },
			result: { exit_code: 0, stdout: "", stderr: "" },
		};
		this._hook_result = {
			exit_code: 0,
			stdout: JSON.stringify({ allowed: true, reason: "" }),
			stderr: "",
		};
	}

	/** Responsibilities: _recording command availability_. **/
	public available(_command: string): boolean {
		return true;
	}

	/** Responsibilities: _hook process result fixture_. **/
	public set_hook_result(result: ReviewAgentProcessResult): void {
		this._hook_result = result;
	}

	/** Responsibilities: _recording command execution_. **/
	public run(command: string, arguments_list: readonly string[], root: string): ReviewAgentProcessResult {
		this._command = command;
		this._arguments_list = arguments_list;
		this._root = root;
		return { exit_code: 0, stdout: "", stderr: "" };
	}

	/** Responsibilities: _recording parallel command execution_. **/
	public run_async(request: ReviewAgentProcessRequest): Promise<ReviewAgentProcessResult> {
		return Promise.resolve(this.run(request.command, request.arguments_list, request.root));
	}

	/** Responsibilities: _recording hook execution_. **/
	public run_hook(request: ReviewAgentHookProcessRequest): ReviewAgentProcessResult {
		this._hook_command = request.command;
		this._hook_file = request.hook_file;
		this._hook_event = request.event;
		this._hook_root = request.root;
		return this._hook_result;
	}

	/** Responsibilities: _recorded process request observation_. **/
	public run_snapshot(): { command: string; arguments_list: readonly string[]; root: string } {
		return { command: this._command, arguments_list: [...this._arguments_list], root: this._root };
	}

	/** Responsibilities: _recorded hook request observation_. **/
	public hook_snapshot(): { command: string; file: string; root: string; review_prefix: string } {
		return {
			command: this._hook_command,
			file: this._hook_file,
			root: this._hook_root,
			review_prefix: this._hook_event.context.review_prefix,
		};
	}
}
