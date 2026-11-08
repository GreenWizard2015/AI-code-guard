import { join } from "node:path";
import { REPORTING_PROJECT_ROOT, REVIEW_FINDING_TARGET } from "src/constants";
import { MarkdownTemplate } from "src/core/support/task/markdown_template";
import { ON_REVIEW_DOCUMENT } from "src/core/support/task/review-agent/constants";
import type {
	ReviewAgentCatalogContract,
	ReviewAgentFilesContract,
} from "src/core/support/task/review-agent/protocols";
import type { ReviewAgentDialogueOptions } from "src/core/support/task/review-agent/types";
import type { ReviewAgentRequest as ReviewRequest } from "src/task_review_types";

/** Responsibilities: _review request construction_, _review size feedback_. **/
export class ReviewAgentDialoguePlan {
	private readonly _root: string;
	private readonly _review_root: string;
	private readonly _instruction: string;
	private readonly _hook_file: string;
	private readonly _hook_command: string;
	private readonly _review_stage: string;
	private readonly _review_prefix: string;
	private readonly _review_stage_plan: string;
	private readonly _review_start_ms: number;
	private readonly _review_documents: ReviewAgentFilesContract;
	private readonly _agent_catalog: ReviewAgentCatalogContract;
	private readonly _progress_template: MarkdownTemplate;

	/** Responsibilities: _review request construction_. **/
	private base_request(prompt = ""): ReviewRequest {
		const progress = this._progress_template.render(
			"{N}",
			String(Math.max(0, REVIEW_FINDING_TARGET - this._review_documents.current_review_notes().length)),
		);
		let agent_prompt = progress;
		if (prompt.length > 0) {
			agent_prompt = `${progress}\n\n${prompt}`;
		}
		return {
			root: this._root,
			instruction: this._instruction,
			review_root: this._review_root,
			hook: {
				hook_file: this._hook_file,
				hook_command: this._hook_command,
				review_prefix: this._review_prefix,
				review_start_ms: this._review_start_ms,
			},
			review_stage: this._review_stage,
			review_stage_plan: this._review_stage_plan,
			open_review_files: this._review_documents.review_notes(),
			prompt: agent_prompt,
		};
	}

	/** Responsibilities: _review dialogue plan initialization_. **/
	public constructor(options: ReviewAgentDialogueOptions) {
		this._root = options.execution.root;
		this._review_root = options.execution.review_root;
		this._instruction = options.execution.instruction;
		this._hook_file = options.execution.hook_file;
		this._hook_command = options.execution.hook_command;
		this._review_stage = options.stage.review_stage;
		this._review_prefix = options.stage.review_prefix;
		this._review_stage_plan = options.stage.review_stage_plan;
		this._review_start_ms = options.stage.review_start_ms;
		this._review_documents = options.collaborators.review_documents;
		this._agent_catalog = options.collaborators.agent_catalog;
		this._progress_template = new MarkdownTemplate(
			join(REPORTING_PROJECT_ROOT, "docs", "agent", ON_REVIEW_DOCUMENT),
			options.collaborators.io,
		);
	}

	/** Responsibilities: _initial review prompt construction_. **/
	public initial_request(prompt: string): ReviewRequest {
		const request = this.base_request(prompt);
		const template_prompt = this._agent_catalog.prompt({ prompt_request: request });
		const agent_prompt = [template_prompt, request.prompt].filter((item) => item.length > 0).join("\n\n");
		return { ...request, prompt: agent_prompt };
	}

	/** Responsibilities: _review size feedback construction_. **/
	public size_feedback(feedback: readonly string[]): string {
		const lines = [
			"Before ending the initial architecture-review dialogue, correct the review files listed below.",
			...feedback,
			"Re-read the affected files after editing and return the paths of every review file that remains.",
		];
		return lines.join("\n");
	}
}
