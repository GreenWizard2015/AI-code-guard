import { basename, dirname, join } from "node:path";
import { TaskRuleDocumentCatalog } from "src/core/support/task/reporting/task_rule_document_catalog";
import { RULE_DATA } from "src/constants";
import type { TaskRuleDocumentationContract, TaskWorkspaceDocumentsContract } from "src/protocols";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _rule document validation_, _rule document publication_. **/
export class TaskRuleDocumentation implements TaskRuleDocumentationContract {
	private readonly documentation_root: string;
	private readonly document_catalog: TaskRuleDocumentCatalog;
	private readonly file_io: IOContract;

	/** Responsibilities: _rule document name validation_. **/
	private validate_rule_names(documentation_directory: string, rule_ids: ReadonlySet<string>): void {
		const rule_id_list = [...rule_ids];
		const paths = rule_id_list.flatMap((rule_id) => {
			return this.document_catalog.rule_documents(rule_id).map((path) => path.slice("docs/rules/".length));
		});
		const expected_paths = new Set(paths);
		for (const path of this.documentation_entries(documentation_directory)) {
			if (!expected_paths.has(path)) {
				throw new Error(`Rule documentation path is unregistered or misplaced: ${path}`);
			}
		}
	}

	/** Responsibilities: _nested documentation paths_. **/
	private documentation_entries(directory: string, prefix = ""): string[] {
		return this.file_io.directory_entries.list_entries(directory).flatMap((entry) => {
			const path = join(prefix, entry.name);
			if (entry.is_directory) {
				return this.documentation_entries(join(directory, entry.name), path);
			}
			return [path];
		});
	}

	/** Responsibilities: _rule document initialization_. **/
	public constructor(documentation_root: string, file_io: IOContract) {
		this.documentation_root = documentation_root;
		this.document_catalog = new TaskRuleDocumentCatalog(documentation_root);
		this.file_io = file_io;
	}

	/** Responsibilities: _rule document coverage_. **/
	public validate_rule_documents(): void {
		const documentation_directory = join(this.documentation_root, "docs", "rules");
		const rule_ids = new Set(Object.keys(RULE_DATA));
		for (const rule_id of rule_ids) {
			for (const path of this.document_catalog.rule_documents(rule_id)) {
				const documentation_file = join(this.documentation_root, path);
				if (this.file_io.directory_entries.path_kind(documentation_file) !== "file") {
					throw new Error(`Rule "${rule_id}" is missing documentation: ${documentation_file}`);
				}
			}
		}
		this.validate_rule_names(documentation_directory, rule_ids);
	}

	/** Responsibilities: _rule document copying_. **/
	public copy_rule_documents(rule_ids: readonly string[], documents: TaskWorkspaceDocumentsContract): void {
		for (const rule_id of rule_ids) {
			const source = this.document_catalog.source_path(rule_id);
			const destination = documents.rule_document_path(rule_id);
			this.file_io.directory_operations.create_directory(dirname(destination));
			this.file_io.file_operations.copy_file(source, destination);
		}
	}

	/** Responsibilities: _staged rule document copying_. **/
	public stage_rule_docs(
		rule_ids: readonly string[],
		directory: string,
		documents: TaskWorkspaceDocumentsContract,
	): void {
		this.file_io.directory_operations.create_directory(directory);
		for (const rule_label of rule_ids) {
			const source = this.document_catalog.source_path(rule_label);
			this.file_io.file_operations.copy_file(
				source,
				join(directory, basename(documents.rule_document_path(rule_label))),
			);
		}
	}
}
