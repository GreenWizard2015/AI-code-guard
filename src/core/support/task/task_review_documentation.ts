import { join } from "node:path";
import {
	REVIEW_CLEANUP_COMMON_DOCUMENT,
	REVIEW_COMMON_DOCUMENT,
	REVIEW_DOCUMENT_NAMES,
	REVIEW_PATH_PLACEHOLDER,
	REVIEW_PREAMBLE_DOCUMENT,
	REVIEW_PREAMBLE_PLACEHOLDER,
	REVIEW_PRIMARY_DOCUMENT,
} from "src/core/support/task/constants";
import { MarkdownTemplate } from "src/core/support/task/markdown_template";
import { ARCHITECTURE_REVIEW_INSTRUCTIONS_HEADING } from "src/core/support/task/review-agent/constants";
import type { IOContract } from "src/io/protocols";
import type { TaskReviewDocumentationContract } from "src/protocols";

/** Responsibilities: _review templates_, _instruction rendering_. **/
export class TaskReviewDocumentation implements TaskReviewDocumentationContract {
	private readonly primary_prompt_file: string;
	private readonly common_prompt_file: string;
	private readonly cleanup_prompt_file: string;
	private readonly preamble_prompt_file: string;
	private readonly review_prompt_files: readonly string[];
	private readonly preamble_template: MarkdownTemplate;
	private readonly io: IOContract;

	/** Responsibilities: _agent instruction position_. **/
	private agent_position(document: string): number {
		if (!document.includes(REVIEW_PATH_PLACEHOLDER)) {
			throw new Error(
				`Architecture review prompt must contain {{REVIEW_PATH}}: ${this.review_prompt_files.join(", ")}`,
			);
		}
		const review_start = document.indexOf(ARCHITECTURE_REVIEW_INSTRUCTIONS_HEADING);
		if (review_start < 0) {
			throw new Error(
				`Architecture review prompt must contain ${ARCHITECTURE_REVIEW_INSTRUCTIONS_HEADING}: ${this.review_prompt_files.join(", ")}`,
			);
		}
		return review_start;
	}

	/** Responsibilities: _agent instruction rendering_. **/
	private read_agent_instruction(review_path: string, source_file: string): string {
		const template = new MarkdownTemplate(source_file, this.io);
		const preamble = this.preamble_template.render_all(new Map());
		const document = template.render_text(
			template.render_all(new Map()),
			new Map([[REVIEW_PREAMBLE_PLACEHOLDER, preamble]]),
		);
		this.agent_position(document);
		const rendered_document = template.render_text(document, new Map([[REVIEW_PATH_PLACEHOLDER, review_path]]));
		const review_start = document.indexOf(ARCHITECTURE_REVIEW_INSTRUCTIONS_HEADING);
		return rendered_document.slice(review_start).trim();
	}

	/** Responsibilities: _review template initialization_. **/
	public constructor(documentation_root: string, io: IOContract) {
		this.io = io;
		this.primary_prompt_file = join(documentation_root, "docs", "agent", REVIEW_PRIMARY_DOCUMENT);
		this.common_prompt_file = join(documentation_root, "docs", "agent", REVIEW_COMMON_DOCUMENT);
		this.cleanup_prompt_file = join(documentation_root, "docs", "agent", REVIEW_CLEANUP_COMMON_DOCUMENT);
		this.preamble_prompt_file = join(documentation_root, "docs", "agent", REVIEW_PREAMBLE_DOCUMENT);
		this.preamble_template = new MarkdownTemplate(this.preamble_prompt_file, io);
		this.review_prompt_files = REVIEW_DOCUMENT_NAMES.map((file) => join(documentation_root, "docs", "agent", file));
	}

	/** Responsibilities: _review template coverage_. **/
	public validate_review_documents(): void {
		if (!this.io.file_paths.path_exists(this.common_prompt_file)) {
			throw new Error(`Architecture review prompt is missing: ${this.common_prompt_file}`);
		}
		if (!this.io.file_paths.path_exists(this.cleanup_prompt_file)) {
			throw new Error(`Architecture review prompt is missing: ${this.cleanup_prompt_file}`);
		}
		if (!this.io.file_paths.path_exists(this.preamble_prompt_file)) {
			throw new Error(`Architecture review prompt is missing: ${this.preamble_prompt_file}`);
		}
		for (const file of this.review_prompt_files) {
			this.read_agent_instruction(REVIEW_PATH_PLACEHOLDER, file);
		}
	}

	/** Responsibilities: _primary review instruction_. **/
	public agent_instruction(review_path: string): string {
		return this.read_agent_instruction(review_path, this.primary_prompt_file);
	}
}
