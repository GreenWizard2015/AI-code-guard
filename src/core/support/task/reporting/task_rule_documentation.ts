import { basename, dirname, join } from "node:path";
import { RULE_DATA, RULE_DOCUMENT_PATHS_BY_ID } from "src/constants";
import type { IOContract } from "src/io/protocols";
import type { TaskRuleDocumentationContract, TaskWorkspaceDocumentsContract } from "src/task_protocols";

/** Responsibilities: _rule document validation_, _rule document publication_. **/
export class TaskRuleDocumentation implements TaskRuleDocumentationContract {
	private readonly _documentation_root: string;
	private readonly _file_io: IOContract;

	/** Responsibilities: _rule document name validation_. **/
	private validate_rule_names(documentation_directory: string, rule_ids: ReadonlySet<string>): void {
		const rule_id_list = [...rule_ids];
		const paths = rule_id_list.flatMap((rule_id) =>
			this.rule_documents(rule_id).map((path) => path.slice("docs/rules/".length)),
		);
		const expected_paths = new Set(paths);
		for (const path of this.documentation_entries(documentation_directory)) {
			if (!expected_paths.has(path)) {
				throw new Error(`Rule documentation path is unregistered or misplaced: ${path}`);
			}
		}
	}

	/** Responsibilities: _nested documentation paths_. **/
	private documentation_entries(directory: string, prefix = ""): string[] {
		return this._file_io.list_entries(directory).flatMap((entry) => {
			const path = join(prefix, entry.name);
			if (entry.is_directory) {
				return this.documentation_entries(join(directory, entry.name), path);
			}
			return [path];
		});
	}

	/** Responsibilities: _rule document initialization_. **/
	public constructor(documentation_root: string, file_io: IOContract) {
		this._documentation_root = documentation_root;
		this._file_io = file_io;
	}

	/** Responsibilities: _rule documentation path index_. **/
	public rule_documents(rule_id: string): readonly string[] {
		const paths = RULE_DOCUMENT_PATHS_BY_ID.get(rule_id);
		if (paths === undefined) {
			throw new Error(`Rule "${rule_id}" is not registered for documentation.`);
		}
		return paths;
	}

	/** Responsibilities: _language-specific rule document path_. **/
	public source_path(rule_label: string): string {
		const suffix_start = rule_label.search(/\[(?:typescript|python)\]$/u);
		let rule_id = rule_label;
		let language = "";
		if (suffix_start >= 0) {
			rule_id = rule_label.slice(0, suffix_start);
			language = rule_label.slice(suffix_start + 1, -1);
		}
		for (const path of this.rule_documents(rule_id)) {
			if (language.length === 0 || path.includes(`/${language}/`)) {
				return join(this._documentation_root, path);
			}
		}
		throw new Error(`Rule "${rule_label}" has no registered documentation path for ${language}.`);
	}

	/** Responsibilities: _rule document coverage_. **/
	public validate_rule_documents(): void {
		const documentation_directory = join(this._documentation_root, "docs", "rules");
		const rule_ids = new Set(Object.keys(RULE_DATA));
		for (const rule_id of rule_ids) {
			for (const path of this.rule_documents(rule_id)) {
				const documentation_file = join(this._documentation_root, path);
				if (!this._file_io.path_is_file(documentation_file)) {
					throw new Error(`Rule "${rule_id}" is missing documentation: ${documentation_file}`);
				}
			}
		}
		this.validate_rule_names(documentation_directory, rule_ids);
	}

	/** Responsibilities: _rule document copying_. **/
	public copy_rule_documents(rule_ids: readonly string[], documents: TaskWorkspaceDocumentsContract): void {
		for (const rule_id of rule_ids) {
			const source = this.source_path(rule_id);
			const destination = documents.rule_document_path(rule_id);
			this._file_io.create_directory(dirname(destination));
			this._file_io.file(source).copy_to(this._file_io.file(destination));
		}
	}

	/** Responsibilities: _staged rule document copying_. **/
	public stage_rule_docs(
		rule_ids: readonly string[],
		directory: string,
		documents: TaskWorkspaceDocumentsContract,
	): void {
		this._file_io.create_directory(directory);
		for (const rule_label of rule_ids) {
			const source = this.source_path(rule_label);
			this._file_io
				.file(source)
				.copy_to(this._file_io.file(join(directory, basename(documents.rule_document_path(rule_label)))));
		}
	}
}
