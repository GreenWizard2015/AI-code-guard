import type { ReviewAgentCatalogContract } from "src/core/support/task/review-agent/protocols";
import type {
	ReviewAgentCleanupRequest,
	ReviewAgentExecutionResult,
	ReviewAgentPromptRequest,
	ReviewAgentRunRequest,
	ReviewAgentSelection,
} from "src/types";
import { join } from "node:path";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _mock review-agent execution_, _review request recording_. **/
export class StubTaskReviewRunner implements ReviewAgentCatalogContract {
	private readonly result: ReviewAgentExecutionResult;
	private readonly finding: string;
	private readonly mutate_source: boolean;
	private readonly io: IOContract;
	public readonly prompts: string[] = [];
	public readonly initial_prefixes: string[] = [];
	public initial_run_count = 0;

	/** Responsibilities: _mock request effects_. **/
	private execute(input: ReviewAgentRunRequest["run_request"]): ReviewAgentExecutionResult {
		this.prompts.push(input.prompt);
		if (this.mutate_source) {
			this.io.file_content.write_text(join(input.root, "source.ts"), "export const changed = true;\n");
		}
		if (input.prompt !== "cleanup") {
			this.initial_run_count += 1;
			this.initial_prefixes.push(input.hook.review_prefix);
			if (this.finding.length > 0) {
				this.io.file_content.write_text(join(input.review_root, `${input.hook.review_prefix}finding.md`), this.finding);
			}
		}
		return this.result;
	}

	/** Responsibilities: _mock runner configuration_. **/
	public constructor(result: ReviewAgentExecutionResult, finding: string, mutate_source: boolean, io: IOContract) {
		this.result = result;
		this.finding = finding;
		this.mutate_source = mutate_source;
		this.io = io;
	}

	/** Responsibilities: _initial prompt extraction_. **/
	public prompt(request: ReviewAgentPromptRequest): string {
		return request.prompt_request.prompt;
	}

	/** Responsibilities: _cleanup prompt extraction_. **/
	public cleanup_prompt(_request: ReviewAgentCleanupRequest): string {
		return "cleanup";
	}

	/** Responsibilities: _synchronous mock compatibility_. **/
	public run(_selection: ReviewAgentSelection, request: ReviewAgentRunRequest): ReviewAgentExecutionResult {
		return this.execute(request.run_request);
	}

	/** Responsibilities: _asynchronous mock execution_. **/
	public run_async(
		_selection: ReviewAgentSelection,
		request: ReviewAgentRunRequest,
	): Promise<ReviewAgentExecutionResult> {
		return Promise.resolve(this.execute(request.run_request));
	}
}
