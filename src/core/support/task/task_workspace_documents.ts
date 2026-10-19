import { join, resolve } from "node:path";
import {
	ISSUES_DOCUMENT_NAME,
	LINT_OUTPUT_DOCUMENT_NAME,
	REPORT_DOCUMENT_NAME,
} from "src/core/support/task/constants";
import { AI_CODE_GUARD_DIRECTORY, RULE_LANGUAGE_BY_ID } from "src/constants";
import type { TaskWorkspaceDocument } from "src/types";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _task document path ownership_, _task document writing_. **/
export class TaskWorkspaceDocuments {
	private readonly workspace_root_value: string;
	private readonly rules_root_value: string;
	private readonly file_io: IOContract;
	protected readonly issues_file: string;
	protected readonly report_file: string;
	protected readonly lint_output_file: string;

	/** Responsibilities: _task document path initialization_. **/
	public constructor(root: string, file_io: IOContract) {
		this.workspace_root_value = resolve(root, AI_CODE_GUARD_DIRECTORY);
		this.rules_root_value = join(this.workspace_root_value, "rules");
		this.file_io = file_io;
		this.issues_file = join(this.workspace_root_value, ISSUES_DOCUMENT_NAME);
		this.report_file = join(this.workspace_root_value, REPORT_DOCUMENT_NAME);
		this.lint_output_file = join(this.workspace_root_value, LINT_OUTPUT_DOCUMENT_NAME);
	}

	/** Responsibilities: _document file path resolution_. **/
	public path_for_document(document: TaskWorkspaceDocument): string {
		if (document === "issues") {
			return this.issues_file;
		}
		if (document === "report") {
			return this.report_file;
		}
		return this.lint_output_file;
	}

	/** Responsibilities: _task document writing_. **/
	public write_document(document: TaskWorkspaceDocument, content: string): void {
		let output = content;
		if (!content.endsWith("\n")) {
			output = `${content}\n`;
		}
		this.file_io.directory_operations.create_directory(this.workspace_root_value);
		this.file_io.file_content.write_text(this.path_for_document(document), output);
	}

	/** Responsibilities: _performance document writing_. **/
	public write_performance(content: string): void {
		let output = content;
		if (!content.endsWith("\n")) {
			output = `${content}\n`;
		}
		this.file_io.directory_operations.create_directory(this.workspace_root_value);
		this.file_io.file_content.write_text(join(this.workspace_root_value, "performance.md"), output);
	}

	/** Responsibilities: _rule document path resolution_. **/
	public rule_document_path(rule_id: string): string {
		let file_name = rule_id;
		const language_start = rule_id.lastIndexOf("[");
		const language = rule_id.slice(language_start + 1, -1);
		const registered_languages = [...RULE_LANGUAGE_BY_ID.values()];
		const is_registered_language = registered_languages.some((registered_language) => registered_language === language);
		if (language_start >= 0 && is_registered_language) {
			file_name = `${language}-${rule_id.slice(0, language_start)}`;
		}
		return join(this.rules_root_value, `${file_name}.md`);
	}
}
