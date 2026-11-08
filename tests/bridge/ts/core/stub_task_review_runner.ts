import { join } from "node:path";
import type { ReviewAgentCatalogContract } from "src/core/support/task/review-agent/protocols";
import type { IOContract } from "src/io/protocols";
import type {
	ReviewAgentExecutionResult,
	ReviewAgentPromptRequest,
	ReviewAgentRunRequest,
	ReviewAgentSelection,
} from "src/task_review_types";

/** Responsibilities: _mock review-agent execution_, _review request recording_. **/
export class StubTaskReviewRunner implements ReviewAgentCatalogContract {
	private readonly _result: ReviewAgentExecutionResult;
	private readonly _finding: string;
	private readonly _mutate_source: boolean;
	private readonly _io: IOContract;
	private readonly _prompts: string[];
	private readonly _initial_prefixes: string[];
	private _initial_run_count = 0;

	/** Responsibilities: _mock request effects_. **/
	private execute(input: ReviewAgentRunRequest["run_request"]): ReviewAgentExecutionResult {
		this._prompts.push(input.prompt);
		if (this._mutate_source) {
			this._io.file(join(input.root, "source.ts")).write_text("export const changed = true;\n");
		}
		this._initial_run_count += 1;
		this._initial_prefixes.push(input.hook.review_prefix);
		if (this._finding.length > 0) {
			this._io.file(join(input.review_root, `${input.hook.review_prefix}finding.md`)).write_text(this._finding);
		}
		return this._result;
	}

	/** Responsibilities: _mock runner configuration_. **/
	public constructor(result: ReviewAgentExecutionResult, finding: string, mutate_source: boolean, io: IOContract) {
		this._prompts = [];
		this._initial_prefixes = [];
		this._result = result;
		this._finding = finding;
		this._mutate_source = mutate_source;
		this._io = io;
	}

	/** Responsibilities: _initial prompt extraction_. **/
	public prompt(request: ReviewAgentPromptRequest): string {
		return request.prompt_request.prompt;
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

	/** Responsibilities: _initial review execution observation_. **/
	public initial_review_snapshot(): { prefixes: readonly string[]; run_count: number } {
		return { prefixes: [...this._initial_prefixes], run_count: this._initial_run_count };
	}
}
