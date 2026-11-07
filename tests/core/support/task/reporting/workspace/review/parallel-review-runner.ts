import { basename, join } from "node:path";
import type { ReviewAgentCatalogContract } from "src/core/support/task/review-agent/protocols";
import type { IOContract } from "src/io/protocols";
import type {
	ReviewAgentCleanupRequest,
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
	private readonly _cleanup_open_files: Map<string, readonly string[]>;
	private readonly _io: IOContract;
	private _max_parallel_active = 0;
	private _reject_prefix = "";
	private _active = 0;

	/** Responsibilities: _parallel review fixture state_. **/
	public constructor(io: IOContract) {
		this._io = io;
		this._initial_prefixes = [];
		this._completed_prefixes = [];
		this._cleanup_open_files = new Map<string, readonly string[]>();
	}

	/** Responsibilities: _review state_. **/
	public snapshot(root: string): {
		initial_prefixes: string[];
		max_parallel_active: number;
		parallel_file: boolean;
		cleanup_open_files: Record<string, readonly string[]>;
	} {
		const initial_prefixes = [...this._initial_prefixes];
		initial_prefixes.sort();
		const cleanup_entries = [...this._cleanup_open_files];
		const cleanup_open_files = cleanup_entries.map(([prefix, files]) => [prefix, files.map((file) => basename(file))]);
		return {
			initial_prefixes,
			max_parallel_active: this._max_parallel_active,
			parallel_file: this._io.file(join(root, ".ai-code-guard", "review", "review-finding.md")).path_exists(),
			cleanup_open_files: Object.fromEntries(cleanup_open_files),
		};
	}

	/** Responsibilities: _review execution_. **/
	public async run_review(create_agent: CallableTaskReviewAgentFactory): Promise<void> {
		const review_agent = create_agent();
		await review_agent.run_parallel("codex", { review_cleanup: true, force_review: false, review_stages: [] });
	}

	/** Responsibilities: _stage failure fixture configuration_. **/
	public reject_on_prefix(prefix: string): void {
		this._reject_prefix = prefix;
	}

	/** Responsibilities: _initial review count observation_. **/
	public initial_review_count(): number {
		return this._initial_prefixes.length;
	}

	/** Responsibilities: _cleanup count observation_. **/
	public cleanup_count(): number {
		return this._cleanup_open_files.size;
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

	/** Responsibilities: _parallel cleanup prompt fixture_. **/
	public cleanup_prompt(_request: ReviewAgentCleanupRequest): string {
		return "cleanup";
	}

	/** Responsibilities: _parallel asynchronous execution fixture_. **/
	public run_async(
		selection: ReviewAgentSelection,
		request: ReviewAgentRunRequest,
	): Promise<ReviewAgentExecutionResult> {
		this._active += 1;
		this._max_parallel_active = Math.max(this._max_parallel_active, this._active);
		return new Promise((resolve, reject) => {
			const cleanup = request.run_request.prompt === "cleanup";
			let delay = 10;
			if (cleanup) {
				delay = 10;
			} else if (request.run_request.hook.review_prefix === "review-data-lifecycle-") {
				delay = 50;
			}
			setTimeout(() => {
				this._completed_prefixes.push(request.run_request.hook.review_prefix);
				if (request.run_request.hook.review_prefix === this._reject_prefix) {
					this._active -= 1;
					reject(new Error("stage failed"));
					return;
				}
				if (cleanup) {
					this._cleanup_open_files.set(request.run_request.hook.review_prefix, request.run_request.open_review_files);
				} else {
					this._initial_prefixes.push(request.run_request.hook.review_prefix);
					const path = join(request.run_request.review_root, `${request.run_request.hook.review_prefix}finding.md`);
					this._io.file(path).write_text(`${Array.from({ length: 20 }, (_, index) => `line ${index}`).join("\n")}\n`);
				}
				this._active -= 1;
				let provider: "codex" | "claude" | "none" = "none";
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
