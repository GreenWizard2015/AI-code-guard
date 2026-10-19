import { basename, join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import type { ReviewAgentCatalogContract } from "src/core/support/task/review-agent/protocols";
import { ReviewAgentCatalog } from "src/core/support/task/review-agent/providers/review_agent_catalog";
import { TaskReviewAgent } from "src/core/support/task/task_review_agent";
import { REVIEW_STAGES } from "src/constants";
import { NodeFileIO } from "src/io/node_file_io";
import type { IOContract } from "src/io/protocols";
import type {
	ReviewAgentCleanupRequest,
	ReviewAgentExecutionResult,
	ReviewAgentPromptRequest,
	ReviewAgentRunRequest,
	ReviewAgentSelection,
} from "src/types";
import { StubReviewHooks } from "tests/bridge/ts/core/review-agent/stub-review-hooks";
import { TaskReportingMemoryFixture } from "tests/bridge/ts/core/support/task-reporting-memory-fixture";

/** Responsibilities: _parallel review_, _review evidence_. **/
class ParallelReviewRunner implements ReviewAgentCatalogContract {
	public readonly root: string;
	public readonly initial_prefixes: string[] = [];
	public readonly completed_prefixes: string[] = [];
	public readonly cleanup_open_files: Map<string, readonly string[]>;
	private readonly io: IOContract;
	public max_parallel_active = 0;
	public reject_prefix = "";
	private active = 0;

	/** Responsibilities: _parallel review fixture state_. **/
	public constructor(root: string, io: IOContract) {
		this.root = root;
		this.io = io;
		this.cleanup_open_files = new Map<string, readonly string[]>();
	}

	/** Responsibilities: _review state_. **/
	public snapshot(root: string): {
		initial_prefixes: string[];
		max_parallel_active: number;
		parallel_file: boolean;
		cleanup_open_files: Record<string, readonly string[]>;
	} {
		const initial_prefixes = [...this.initial_prefixes];
		initial_prefixes.sort();
		const cleanup_entries = [...this.cleanup_open_files];
		const cleanup_open_files = cleanup_entries.map(([prefix, files]) => [prefix, files.map((file) => basename(file))]);
		return {
			initial_prefixes,
			max_parallel_active: this.max_parallel_active,
			parallel_file: this.io.file_paths.path_exists(join(root, ".ai-code-guard", "review", "review-finding.md")),
			cleanup_open_files: Object.fromEntries(cleanup_open_files),
		};
	}

	/** Responsibilities: _review execution_. **/
	public async run_review(create_agent: () => TaskReviewAgent): Promise<void> {
		const review_agent = create_agent();
		await review_agent.run_parallel("codex", { review_cleanup: true, force_review: false, review_stages: [] });
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
		this.active += 1;
		this.max_parallel_active = Math.max(this.max_parallel_active, this.active);
		return new Promise((resolve, reject) => {
			const cleanup = request.run_request.prompt === "cleanup";
			let delay = 10;
			if (cleanup) {
				delay = 10;
			} else if (request.run_request.hook.review_prefix === "review-data-lifecycle-") {
				delay = 50;
			}
			setTimeout(() => {
				this.completed_prefixes.push(request.run_request.hook.review_prefix);
				if (request.run_request.hook.review_prefix === this.reject_prefix) {
					this.active -= 1;
					reject(new Error("stage failed"));
					return;
				}
				if (cleanup) {
					this.cleanup_open_files.set(request.run_request.hook.review_prefix, request.run_request.open_review_files);
				} else {
					this.initial_prefixes.push(request.run_request.hook.review_prefix);
					const path = join(request.run_request.review_root, `${request.run_request.hook.review_prefix}finding.md`);
					this.io.file_content.write_text(
						path,
						`${Array.from({ length: 20 }, (_, index) => `line ${index}`).join("\n")}\n`,
					);
				}
				this.active -= 1;
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

describe("parallel task review agent", () => {
	test("runs five concurrent provider requests with stage-specific prefixes", async () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create({ "source.ts": "export const source = true;\n" });
		const { root, file_io: io } = fixture;
		const runner = new ParallelReviewRunner(root, io);
		await runner.run_review(
			() =>
				new TaskReviewAgent({
					root,
					agent_catalog: runner,
					hooks: new StubReviewHooks(),
					hook_command: "/tools/tsx",
					hook_file: "/tools/agent-hooks.ts",
					file_io: io,
				}),
		);
		const result = runner.snapshot(root);
		expect(result).toEqual({
			initial_prefixes: REVIEW_STAGES.map((stage) => stage.prefix).sort(),
			max_parallel_active: 5,
			parallel_file: false,
			cleanup_open_files: {
				"review-boundaries-": ["review-boundaries-finding.md"],
				"review-data-lifecycle-": ["review-data-lifecycle-finding.md"],
				"review-algorithms-": ["review-algorithms-finding.md"],
				"review-tests-": ["review-tests-finding.md"],
				"review-abstractions-": ["review-abstractions-finding.md"],
			},
		});
	});

	test("does not run cleanup by default", async () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create();
		const { root, file_io: io } = fixture;
		const runner = new ParallelReviewRunner(root, io);
		const agent = new TaskReviewAgent({
			root,
			agent_catalog: runner,
			hooks: new StubReviewHooks(),
			hook_command: "/tools/tsx",
			hook_file: "/tools/agent-hooks.ts",
			file_io: io,
		});
		await agent.run_parallel("codex", { review_cleanup: false, force_review: false, review_stages: [] });
		expect(runner.cleanup_open_files.size).toBe(0);
	});

	test("force review starts when open findings already exist", async () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create();
		const { root, file_io: io } = fixture;
		io.directory_operations.create_directory(join(root, ".ai-code-guard", "review"));
		io.file_content.write_text(join(root, ".ai-code-guard", "review", "open-finding.md"), "# Open finding\n");
		const runner = new ParallelReviewRunner(root, io);
		const agent = new TaskReviewAgent({
			root,
			agent_catalog: runner,
			hooks: new StubReviewHooks(),
			hook_command: "/tools/tsx",
			hook_file: "/tools/agent-hooks.ts",
			file_io: io,
		});
		await agent.run_parallel("codex", { review_cleanup: false, force_review: true, review_stages: [] });
		expect(runner.initial_prefixes).toHaveLength(5);
	});

	test("keeps cleanup as a separate dialogue", () => {
		const catalog = new ReviewAgentCatalog([], new NodeFileIO());
		const request: ReviewAgentCleanupRequest = {
			cleanup_request: {
				root: "",
				instruction: "",
				review_root: "",
				hook: {
					hook_file: "",
					hook_command: "",
					review_prefix: "",
					review_phase: "cleanup",
				},
				review_stage: "",
				review_stage_plan: "",
				open_review_files: [],
				prompt: "",
			},
		};
		expect(catalog.cleanup_prompt(request)).toContain("architecture review");
	});

	test("starts the first review run", async () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create();
		const { root, file_io: io } = fixture;
		const runner = new ParallelReviewRunner(root, io);
		const agent = new TaskReviewAgent({
			root,
			agent_catalog: runner,
			hooks: new StubReviewHooks(),
			hook_command: "/tools/tsx",
			hook_file: "/tools/agent-hooks.ts",
			file_io: io,
		});
		const result = await agent.run_parallel("codex", {
			review_cleanup: false,
			force_review: false,
			review_stages: [],
		});
		expect(result.provider).toBe("codex");
	});

	test("waits for every stage before releasing the run lock after a stage failure", async () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create();
		const { root, file_io: io } = fixture;
		const runner = new ParallelReviewRunner(root, io);
		runner.reject_prefix = "review-abstractions-";
		const agent = new TaskReviewAgent({
			root,
			agent_catalog: runner,
			hooks: new StubReviewHooks(),
			hook_command: "/tools/tsx",
			hook_file: "/tools/agent-hooks.ts",
			file_io: io,
		});

		const result = await agent.run_parallel("codex", {
			review_cleanup: false,
			force_review: false,
			review_stages: [],
		});

		expect({ provider: result.provider, completed: runner.completed_prefixes.sort() }).toEqual({
			provider: "none",
			completed: [
				"review-abstractions-",
				"review-algorithms-",
				"review-boundaries-",
				"review-data-lifecycle-",
				"review-tests-",
			],
		});
	});

	test("rejects a second review run while the first run is active", async () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create();
		const { root, file_io: io } = fixture;
		const runner = new ParallelReviewRunner(root, io);
		const agent = new TaskReviewAgent({
			root,
			agent_catalog: runner,
			hooks: new StubReviewHooks(),
			hook_command: "/tools/tsx",
			hook_file: "/tools/agent-hooks.ts",
			file_io: io,
		});
		const first_run = agent.run_parallel("codex", {
			review_cleanup: false,
			force_review: false,
			review_stages: [],
		});
		const second_result = await agent.run_parallel("codex", {
			review_cleanup: false,
			force_review: false,
			review_stages: [],
		});
		const first_result = await first_run;
		expect({ first: first_result.provider, second: second_result.provider }).toEqual({
			first: "codex",
			second: "none",
		});
	});
});
