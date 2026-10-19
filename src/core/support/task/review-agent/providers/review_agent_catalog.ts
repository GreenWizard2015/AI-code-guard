import { join } from "node:path";
import {
	REVIEW_CLEANUP_COMMON_DOCUMENT,
	REVIEW_COMMON_DOCUMENT,
	REVIEW_FINDING_DOCUMENT,
	REVIEW_PREAMBLE_DOCUMENT,
} from "src/core/support/task/constants";
import {
	ALLOWED_OPERATIONS_PLACEHOLDER,
	REVIEW_PATH_PLACEHOLDER,
	REVIEW_PREAMBLE_PLACEHOLDER,
} from "src/core/support/task/constants";
import { MarkdownTemplate } from "src/core/support/task/markdown_template";
import type {
	MarkdownTemplateContract,
	ReviewAgentCatalogContract,
	ReviewAgentContract,
} from "src/core/support/task/review-agent/protocols";
import { REPORTING_PROJECT_ROOT, REVIEW_STAGES } from "src/constants";
import type {
	ReviewAgentCleanupRequest,
	ReviewAgentExecutionResult,
	ReviewAgentPromptRequest,
	ReviewAgentRunRequest,
	ReviewAgentSelection,
} from "src/types";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _review-agent provider catalog_, _review-agent selection_. **/
export class ReviewAgentCatalog implements ReviewAgentCatalogContract {
	private readonly agents: readonly ReviewAgentContract[];
	private readonly io: IOContract;
	private readonly allowed_operations: string;
	private readonly cleanup_allowed_operations: string;
	private readonly finding_rules: string;
	private readonly review_preamble: string;
	private readonly common_template: MarkdownTemplate;
	private readonly finding_template: MarkdownTemplate;

	/** Responsibilities: _multi-stage instruction assembly_. **/
	private review_instructions(templates: readonly MarkdownTemplateContract[]): string {
		return templates
			.slice(1)
			.map((template) =>
				template.render_all(
					new Map([
						[REVIEW_PREAMBLE_PLACEHOLDER, ""],
						[ALLOWED_OPERATIONS_PLACEHOLDER, ""],
					]),
				),
			)
			.map((template) => template.trim())
			.join("\n\n");
	}

	/** Responsibilities: _file paths_. **/
	private file_paths(files: readonly string[]): string {
		if (files.length === 0) {
			return "- None";
		}
		return files.map((file) => `- ${file}`).join("\n");
	}

	/** Responsibilities: _review prompt value collection_. **/
	private prompt_values(
		request: ReviewAgentPromptRequest,
		open_reviews: string,
		review_instructions: string,
	): ReadonlyMap<string, string> {
		const prompt = request.prompt_request;
		return new Map([
			[REVIEW_PREAMBLE_PLACEHOLDER, this.review_preamble],
			["{{ROOT}}", prompt.root],
			["{{INSTRUCTION}}", prompt.instruction],
			["{{REVIEW_PREFIX}}", prompt.hook.review_prefix],
			["{{REVIEW_STAGE}}", ""],
			["{{REVIEW_STAGE_PLAN}}", ""],
			[ALLOWED_OPERATIONS_PLACEHOLDER, this.allowed_operations],
			["{{CLEANUP_ALLOWED_OPERATIONS}}", this.cleanup_allowed_operations],
			["{{REVIEW_FINDING_RULES}}", this.finding_rules],
			["{{REVIEW_INSTRUCTIONS}}", review_instructions],
			["{{OPEN_REVIEWS}}", open_reviews],
			[REVIEW_PATH_PLACEHOLDER, prompt.review_root],
			["{{REVIEW_ROOT}}", prompt.review_root],
		]);
	}

	/** Responsibilities: _review prompt template reading_, _prompt value substitution_. **/
	private prompt_from_documents(request: ReviewAgentPromptRequest, documents: readonly string[]): string {
		const templates = documents.map(
			(document) => new MarkdownTemplate(join(REPORTING_PROJECT_ROOT, "docs", "agent", document), this.io),
		);
		const template_texts = templates.map((template) => template.render_all(new Map()));
		const template = template_texts.join("\n\n");
		const review_instructions = this.review_instructions(templates);
		const open_reviews = this.file_paths(request.prompt_request.open_review_files);
		return this.common_template
			.render_text(template, this.prompt_values(request, open_reviews, review_instructions))
			.trim();
	}

	/** Responsibilities: _parallel review-agent result_. **/
	private async agent_result_async(
		agent: ReviewAgentContract,
		request: ReviewAgentRunRequest,
	): Promise<ReviewAgentExecutionResult> {
		let prompt = request.run_request.prompt;
		if (prompt.length === 0) {
			prompt = this.prompt({ prompt_request: request.run_request });
		}
		const process = await agent.run_async({ ...request.run_request, prompt });
		if (process.exit_code !== 0) {
			return {
				provider: "none",
				process,
				no_issues: false,
				message: `${agent.agent_name()} exited with code ${process.exit_code}. Rerun with \`ai-code-guard --review-agent ${agent.agent_name()}\`; optionally choose the model or reasoning effort before rerunning.`,
			};
		}
		return {
			provider: agent.agent_name(),
			process,
			no_issues: false,
			message: `${agent.agent_name()} review completed.`,
		};
	}

	/** Responsibilities: _review-agent selection_. **/
	private async selected_agent(
		selection: ReviewAgentSelection,
		request: ReviewAgentRunRequest,
	): Promise<ReviewAgentExecutionResult> {
		for (const agent of this.agents) {
			if (agent.agent_name() !== selection) {
				continue;
			}
			if (!agent.available()) {
				return {
					provider: "none",
					process: { exit_code: 1, stdout: "", stderr: `${selection} is unavailable` },
					no_issues: false,
					message: `${selection} is unavailable. Rerun with \`ai-code-guard --review-agent ${selection}\`; optionally choose the model or reasoning effort before rerunning.`,
				};
			}
			return this.agent_result_async(agent, request);
		}
		return {
			provider: "none",
			process: { exit_code: 1, stdout: "", stderr: `${selection} is not configured` },
			no_issues: false,
			message: `${selection} is not configured`,
		};
	}

	/** Responsibilities: _review-agent provider initialization_. **/
	constructor(agents: readonly ReviewAgentContract[], io: IOContract) {
		this.agents = agents;
		this.io = io;
		this.common_template = new MarkdownTemplate(
			join(REPORTING_PROJECT_ROOT, "docs", "agent", REVIEW_COMMON_DOCUMENT),
			this.io,
		);
		const cleanup_common_template = new MarkdownTemplate(
			join(REPORTING_PROJECT_ROOT, "docs", "agent", REVIEW_CLEANUP_COMMON_DOCUMENT),
			this.io,
		);
		this.finding_template = new MarkdownTemplate(
			join(REPORTING_PROJECT_ROOT, "docs", "agent", REVIEW_FINDING_DOCUMENT),
			this.io,
		);
		const preamble_template = new MarkdownTemplate(
			join(REPORTING_PROJECT_ROOT, "docs", "agent", REVIEW_PREAMBLE_DOCUMENT),
			this.io,
		);
		this.allowed_operations = this.common_template.render_all(new Map());
		this.cleanup_allowed_operations = cleanup_common_template.render_all(new Map());
		this.finding_rules = this.finding_template.render_all(new Map());
		this.review_preamble = preamble_template.render_all(new Map());
	}

	/** Responsibilities: _review-agent prompt construction_. **/
	public prompt(request: ReviewAgentPromptRequest): string {
		if (request.prompt_request.review_stage === "all") {
			return this.prompt_from_documents(
				request,
				REVIEW_STAGES.map((stage) => stage.document),
			);
		}
		const stage = REVIEW_STAGES.find((item) => item.id === request.prompt_request.review_stage);
		if (stage === undefined) {
			throw new Error(`Unknown architecture review stage: ${request.prompt_request.review_stage}`);
		}
		return this.prompt_from_documents(request, [stage.document]);
	}

	/** Responsibilities: _minor-finding cleanup prompt construction_. **/
	public cleanup_prompt(request: ReviewAgentCleanupRequest): string {
		return this.prompt_from_documents({ prompt_request: request.cleanup_request }, [
			"architecture-review-cleanup-prompt.md",
			...REVIEW_STAGES.map((stage) => stage.document),
		]);
	}

	/** Responsibilities: _parallel review-agent execution_. **/
	public run_async(
		selection: ReviewAgentSelection,
		request: ReviewAgentRunRequest,
	): Promise<ReviewAgentExecutionResult> {
		if (selection === "none") {
			return Promise.resolve({
				provider: "none",
				process: { exit_code: 1, stdout: "", stderr: "" },
				no_issues: false,
				message: "No review agent was selected. Architecture review is skipped unless --review-agent codex|claude is provided.",
			});
		}
		return this.selected_agent(selection, request);
	}
}
