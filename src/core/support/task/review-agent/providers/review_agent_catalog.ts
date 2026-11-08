import { join } from "node:path";
import { REPORTING_PROJECT_ROOT, REVIEW_STAGES } from "src/constants";
import {
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
import type { IOContract } from "src/io/protocols";
import type {
	ReviewAgentExecutionResult,
	ReviewAgentPromptRequest,
	ReviewAgentPromptValues,
	ReviewAgentRequest,
	ReviewAgentRunRequest,
	ReviewAgentSelection,
} from "src/task_review_types";

/** Responsibilities: _review-agent provider catalog_, _review-agent selection_. **/
export class ReviewAgentCatalog implements ReviewAgentCatalogContract {
	private readonly _agents: readonly ReviewAgentContract[];
	private readonly _io: IOContract;
	private readonly _allowed_operations: string;
	private readonly _finding_rules: string;
	private readonly _review_preamble: string;
	private readonly _common_template: MarkdownTemplate;
	private readonly _finding_template: MarkdownTemplate;

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
		request_values: ReviewAgentPromptValues,
		open_reviews: string,
		review_instructions: string,
	): ReadonlyMap<string, string> {
		return new Map([
			[REVIEW_PREAMBLE_PLACEHOLDER, this._review_preamble],
			["{{ROOT}}", request_values.root],
			["{{INSTRUCTION}}", request_values.instruction],
			["{{REVIEW_PREFIX}}", request_values.review_prefix],
			["{{REVIEW_STAGE}}", ""],
			["{{REVIEW_STAGE_PLAN}}", ""],
			[ALLOWED_OPERATIONS_PLACEHOLDER, this._allowed_operations],
			["{{REVIEW_FINDING_RULES}}", this._finding_rules],
			["{{REVIEW_INSTRUCTIONS}}", review_instructions],
			["{{OPEN_REVIEWS}}", open_reviews],
			[REVIEW_PATH_PLACEHOLDER, request_values.review_root],
			["{{REVIEW_ROOT}}", request_values.review_root],
		]);
	}

	/** Responsibilities: _review prompt template reading_, _prompt value substitution_. **/
	private prompt_from_documents(request: ReviewAgentPromptRequest, documents: readonly string[]): string {
		const templates = documents.map(
			(document) => new MarkdownTemplate(join(REPORTING_PROJECT_ROOT, "docs", "agent", document), this._io),
		);
		const template_texts = templates.map((template) => template.render_all(new Map()));
		const template = template_texts.join("\n\n");
		const review_instructions = this.review_instructions(templates);
		const open_reviews = this.file_paths(request.prompt_request.open_review_files);
		return this._common_template
			.render_text(
				template,
				this.prompt_values(
					{
						root: request.prompt_request.root,
						instruction: request.prompt_request.instruction,
						review_prefix: request.prompt_request.hook.review_prefix,
						review_root: request.prompt_request.review_root,
					},
					open_reviews,
					review_instructions,
				),
			)
			.trim();
	}

	/** Responsibilities: _parallel review-agent result_. **/
	private async agent_result_async(
		agent: ReviewAgentContract,
		request: ReviewAgentRequest,
	): Promise<ReviewAgentExecutionResult> {
		let prompt = request.prompt;
		if (prompt.length === 0) {
			prompt = this.prompt({ prompt_request: request });
		}
		const process = await agent.run_async({ ...request, prompt });
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
	private selected_agent(
		selection: ReviewAgentSelection,
		request: ReviewAgentRequest,
	): Promise<ReviewAgentExecutionResult> {
		for (const agent of this._agents) {
			if (agent.agent_name() !== selection) {
				continue;
			}
			if (!agent.available()) {
				return Promise.resolve({
					provider: "none",
					process: { exit_code: 1, stdout: "", stderr: `${selection} is unavailable` },
					no_issues: false,
					message: `${selection} is unavailable. Rerun with \`ai-code-guard --review-agent ${selection}\`; optionally choose the model or reasoning effort before rerunning.`,
				});
			}
			return this.agent_result_async(agent, request);
		}
		return Promise.resolve({
			provider: "none",
			process: { exit_code: 1, stdout: "", stderr: `${selection} is not configured` },
			no_issues: false,
			message: `${selection} is not configured`,
		});
	}

	/** Responsibilities: _review-agent provider initialization_. **/
	public constructor(agents: readonly ReviewAgentContract[], io: IOContract) {
		this._agents = agents;
		this._io = io;
		this._common_template = new MarkdownTemplate(
			join(REPORTING_PROJECT_ROOT, "docs", "agent", REVIEW_COMMON_DOCUMENT),
			this._io,
		);
		this._finding_template = new MarkdownTemplate(
			join(REPORTING_PROJECT_ROOT, "docs", "agent", REVIEW_FINDING_DOCUMENT),
			this._io,
		);
		const preamble_template = new MarkdownTemplate(
			join(REPORTING_PROJECT_ROOT, "docs", "agent", REVIEW_PREAMBLE_DOCUMENT),
			this._io,
		);
		this._allowed_operations = this._common_template.render_all(new Map());
		this._finding_rules = this._finding_template.render_all(new Map());
		this._review_preamble = preamble_template.render_all(new Map());
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
				message:
					"No review agent was selected. Architecture review is skipped unless --review-agent codex|cx|cxa|claude is provided.",
			});
		}
		return this.selected_agent(selection, request.run_request);
	}
}
