import { dirname, join } from "node:path";
import { REVIEW_STOP_LOG_FILE_NAME } from "src/core/support/task/review-agent/constants";
import type { ReviewAgentDebugLogContract } from "src/core/support/task/review-agent/protocols";
import type { IOContract } from "src/io/protocols";
import type { ReviewAgentExecutionResult, ReviewAgentRequest } from "src/task_review_types";

/** Responsibilities: _agent diagnostics_, _debug artifact storage_. **/
export class ReviewAgentDebugLog implements ReviewAgentDebugLogContract {
	private readonly _file: string;
	private readonly _io: IOContract;

	/** Responsibilities: _diagnostic file path_. **/
	public constructor(workspace_root: string, io: IOContract) {
		this._file = join(workspace_root, REVIEW_STOP_LOG_FILE_NAME);
		this._io = io;
	}

	/** Responsibilities: _diagnostic file reset_. **/
	public clear(): void {
		this._io.create_directory(dirname(this._file));
		const heading = "# Review agent debug log\n";
		this._io.file(this._file).write_text(heading);
	}

	/** Responsibilities: _review-agent process diagnostics_. **/
	public append(dialogue: string, request: ReviewAgentRequest, execution: ReviewAgentExecutionResult): void {
		const lines = [
			`## ${dialogue}`,
			`Provider: ${execution.provider}`,
			`Review stage: ${request.review_stage}`,
			`Review prefix: ${request.hook.review_prefix}`,
			`Root: ${request.root}`,
			`Review root: ${request.review_root}`,
			`Exit code: ${execution.process.exit_code}`,
			"Prompt:",
			request.prompt,
			"Stdout:",
			execution.process.stdout,
			"Stderr:",
			execution.process.stderr,
			"",
		];
		this._io.file(this._file).append_text(`${lines.join("\n")}\n`);
	}
}
