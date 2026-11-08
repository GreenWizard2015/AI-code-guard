import { join } from "node:path";
import type { ReviewAgentCatalogContract } from "src/core/support/task/review-agent/protocols";
import type { IOContract } from "src/io/protocols";
import type {
	ReviewAgentExecutionResult,
	ReviewAgentPromptRequest,
	ReviewAgentRunRequest,
	ReviewAgentSelection,
} from "src/task_review_types";
import type { CallableTaskReviewAgentFactory } from "tests/core/types";

/** Responsibilities: _parallel review_, _review evidence_. **/
export class ParallelReviewRunner implements ReviewAgentCatalogContract {
	private readonly _initial_prefixes: string[];
	private readonly _completed_prefixes: string[];
	private readonly _io: IOContract;
	private _max_parallel_active = 0;
	private _reject_prefix = "";
	private _active = 0;

	/** Responsibilities: _parallel review fixture state_. **/
	public constructor(io: IOContract) {
		this._io = io;
		this._initial_prefixes = [];
		this._completed_prefixes = [];
	}

	/** Responsibilities: _review state_. **/
	public snapshot(root: string): {
		initial_prefixes: string[];
		max_parallel_active: number;
		parallel_file: boolean;
	} {
		const initial_prefixes = [...this._initial_prefixes];
		initial_prefixes.sort();
		return {
			initial_prefixes,
			max_parallel_active: this._max_parallel_active,
			parallel_file: this._io.file(join(root, ".ai-code-guard", "review", "review-finding.md")).path_exists(),
		};
	}

	/** Responsibilities: _review execution_. **/
	public async run_review(create_agent: CallableTaskReviewAgentFactory): Promise<void> {
		const agent = create_agent();
		await agent.run_parallel("codex", { force_review: false, review_stages: [] });
	}

	/** Responsibilities: _stage failure fixture configuration_. **/
	public reject_on_prefix(prefix: string): void {
		this._reject_prefix = prefix;
	}

	/** Responsibilities: _initial review count observation_. **/
	public initial_review_count(): number {
		return this._initial_prefixes.length;
	}

	/** Responsibilities: _completed stage observation_. **/
	public completed_prefixes(): readonly string[] {
		const prefixes = [...this._completed_prefixes];
		prefixes.sort();
		return prefixes;
	}

	/** Responsibilities: _parallel review prompt fixture_. **/
	public prompt(request: ReviewAgentPromptRequest): string {
		return request.prompt_request.prompt;
	}

	/** Responsibilities: _parallel asynchronous execution fixture_. **/
	public run_async(
		selection: ReviewAgentSelection,
		request: ReviewAgentRunRequest,
	): Promise<ReviewAgentExecutionResult> {
		this._active += 1;
		this._max_parallel_active = Math.max(this._max_parallel_active, this._active);
		return new Promise((resolve, reject) => {
			let delay = 10;
			if (request.run_request.hook.review_prefix === "review-data-lifecycle-") {
				delay = 50;
			}
			setTimeout(() => {
				this._completed_prefixes.push(request.run_request.hook.review_prefix);
				if (request.run_request.hook.review_prefix === this._reject_prefix) {
					this._active -= 1;
					reject(new Error("stage failed"));
					return;
				}
				this._initial_prefixes.push(request.run_request.hook.review_prefix);
				const path = join(request.run_request.review_root, `${request.run_request.hook.review_prefix}finding.md`);
				this._io.file(path).write_text(`${Array.from({ length: 20 }, (_, index) => `line ${index}`).join("\n")}\n`);
				this._active -= 1;
				let provider: ReviewAgentSelection = "none";
				if (selection !== "none") {
					provider = selection;
				}
				resolve({
					provider,
					process: { exit_code: 0, stdout: "", stderr: "" },
					no_issues: false,
					message: "done",
				});
			}, delay);
		});
	}
}
