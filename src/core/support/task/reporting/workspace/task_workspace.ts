import { join, resolve } from "node:path";
import { AI_CODE_GUARD_DIRECTORY } from "src/constants";
import { RULE_LANGUAGE_BY_ID } from "src/constants";
import {
	ISSUES_DOCUMENT_NAME,
	LINT_OUTPUT_DOCUMENT,
	LINT_OUTPUT_DOCUMENT_NAME,
	PERFORMANCE_DOCUMENT_NAME,
	REPORT_DOCUMENT_NAME,
} from "src/core/support/task/constants";
import type { IOContract } from "src/io/protocols";
import type { TaskWorkspaceContract, TaskWorkspaceDocumentsContract } from "src/task_protocols";
import type { TaskWorkspaceDocument } from "src/task_types";

/** Responsibilities: _task document ownership_, _workspace lifecycle_. **/
export class TaskWorkspace implements TaskWorkspaceContract, TaskWorkspaceDocumentsContract {
	private readonly _workspace_root: string;
	private readonly _rules_root: string;
	private readonly _file_io: IOContract;
	private readonly _document_paths: ReadonlyMap<TaskWorkspaceDocument, string>;

	/** Responsibilities: _task workspace lifecycle initialization_. **/
	public constructor(root: string, file_io: IOContract) {
		this._workspace_root = resolve(root, AI_CODE_GUARD_DIRECTORY);
		this._rules_root = join(this._workspace_root, "rules");
		this._file_io = file_io;
		this._document_paths = new Map([
			["issues", join(this._workspace_root, ISSUES_DOCUMENT_NAME)],
			["report", join(this._workspace_root, REPORT_DOCUMENT_NAME)],
			[LINT_OUTPUT_DOCUMENT, join(this._workspace_root, LINT_OUTPUT_DOCUMENT_NAME)],
		]);
	}

	/** Responsibilities: _current task issue cleanup_. **/
	public clear_batch(): void {
		this.prepare_review();
		this._file_io.remove_path(this._rules_root);
		this._file_io.create_directory(this._rules_root);
		for (const document of ["issues", "report", LINT_OUTPUT_DOCUMENT] as const) {
			this._file_io.remove_path(this.path_for_document(document));
		}
	}

	/** Responsibilities: _architecture review workspace preparation_. **/
	public prepare_review(): void {
		this._file_io.create_directory(this._workspace_root);
		this._file_io.create_directory(join(this._workspace_root, "review"));
		this._file_io.remove_path(join(this._workspace_root, "architecture-review-prompt.md"));
	}

	/** Responsibilities: _document file path resolution_. **/
	public path_for_document(document: TaskWorkspaceDocument): string {
		const path = this._document_paths.get(document);
		if (path === undefined) {
			throw new Error(`Task document path is unavailable for ${document}.`);
		}
		return path;
	}

	/** Responsibilities: _task document writing_. **/
	public write_document(document: TaskWorkspaceDocument, content: string): void {
		let output = content;
		if (!content.endsWith("\n")) {
			output = `${content}\n`;
		}
		this._file_io.create_directory(this._workspace_root);
		this._file_io.file(this.path_for_document(document)).write_text(output);
	}

	/** Responsibilities: _performance document writing_. **/
	public write_performance(content: string): void {
		let output = content;
		if (!content.endsWith("\n")) {
			output = `${content}\n`;
		}
		this._file_io.create_directory(this._workspace_root);
		this._file_io.file(join(this._workspace_root, PERFORMANCE_DOCUMENT_NAME)).write_text(output);
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
		return join(this._rules_root, `${file_name}.md`);
	}
}
