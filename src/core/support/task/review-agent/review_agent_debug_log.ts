import { dirname, join } from "node:path";
import type { ReviewAgentDebugLogContract } from "src/core/support/task/review-agent/protocols";
import type { IOContract } from "src/io/protocols";
import type { ReviewAgentExecutionResult, ReviewAgentRequest } from "src/types";

/** Responsibilities: _agent diagnostics_, _debug artifact storage_. **/
export class ReviewAgentDebugLog implements ReviewAgentDebugLogContract {
	private readonly file: string;
	private readonly io: IOContract;

	/** Responsibilities: _diagnostic file path_. **/
	public constructor(workspace_root: string, io: IOContract) {
		this.file = join(workspace_root, "agent-debug.log");
		this.io = io;
	}

	/** Responsibilities: _diagnostic file reset_. **/
	public clear(): void {
		this.io.directory_operations.create_directory(dirname(this.file));
		const heading = "# Review agent debug log\n";
		this.io.file_content.write_text(this.file, heading);
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
		this.io.file_content.append_text(this.file, `${lines.join("\n")}\n`);
	}
}
