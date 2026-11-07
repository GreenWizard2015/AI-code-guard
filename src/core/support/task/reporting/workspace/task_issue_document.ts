import { dirname, join } from "node:path";
import type { SystemFailureClassificationContract } from "src/analysis_protocols";
import { TaskRuleLanguageGroups } from "src/core/support/task/reporting/task_rule_language_groups";
import { TaskIssueRuleSection } from "src/core/support/task/reporting/workspace/task_issue_rule_section";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";
import { SYSTEM_FAILURE_CODES } from "src/io/constants";
import type { IOContract } from "src/io/protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type {
	TaskBatchReplacementContract,
	TaskIssueDocumentContract,
	TaskRuleDocumentationContract,
	TaskWorkspaceDocumentsContract,
} from "src/task_protocols";
import type { TaskWorkspaceDocument } from "src/task_types";

/** Responsibilities: _issue formatting_, _source context_. **/
export class TaskIssueDocument implements TaskIssueDocumentContract {
	private readonly _root: string;
	private readonly _documents: TaskWorkspaceDocumentsContract;
	private readonly _batch: TaskBatchReplacementContract;
	private readonly _documentation: TaskRuleDocumentationContract;
	private readonly _file_io: IOContract;
	private readonly _boundary_failures: SystemFailureClassificationContract;

	/** Responsibilities: _architecture review section_. **/
	private review_section(review_files: readonly string[]): string {
		if (review_files.length === 0) {
			return "";
		}
		const review_lines = ["# Unresolved architecture review files", ...review_files.map((file) => `- ${file}`)];
		return review_lines.join("\n");
	}

	/** Responsibilities: _rule sections composition_. **/
	private rule_section(rule_id: string, violations: readonly ViolationContract[]): string {
		const first_violation = violations.values().next();
		if (first_violation.done) {
			return "";
		}
		const section = new TaskIssueRuleSection({
			root: this._root,
			rule_id,
			first: first_violation.value,
			violations,
			documents: this._documents,
			file_io: this._file_io,
			boundary_failures: this._boundary_failures,
		});
		return section.format();
	}

	/** Responsibilities: _rule sections composition_. **/
	private rule_sections(groups: ReadonlyMap<string, readonly ViolationContract[]>): string {
		const ordered_groups = [...groups.entries()];
		ordered_groups.sort(([left], [right]) => left.localeCompare(right));
		const rendered_sections: string[] = [];
		for (const [rule_id, violations] of ordered_groups) {
			const section = this.rule_section(rule_id, violations);
			if (section.length > 0) {
				rendered_sections.push(section);
			}
		}
		return rendered_sections.join("\n\n");
	}

	/** Responsibilities: _initialization workspace paths task_. **/
	public constructor(
		root: string,
		documents: TaskWorkspaceDocumentsContract,
		batch: TaskBatchReplacementContract,
		documentation: TaskRuleDocumentationContract,
		file_io: IOContract,
	) {
		this._root = root;
		this._documents = documents;
		this._batch = batch;
		this._documentation = documentation;
		this._file_io = file_io;
		this._boundary_failures = new BoundaryFailureClassifier(SYSTEM_FAILURE_CODES);
	}

	/** Responsibilities: _output formatting issue document_. **/
	public write(
		violations: readonly ViolationContract[],
		review_files: readonly string[],
		documents: ReadonlyMap<TaskWorkspaceDocument, string>,
	): void {
		const rule_language_groups = new TaskRuleLanguageGroups(violations);
		const grouped_violations = rule_language_groups.grouped_violations();
		const issue_sections = [this.rule_sections(grouped_violations), this.review_section(review_files)];
		const content = issue_sections.filter((section) => section.length > 0).join("\n\n");
		const rule_ids = [...grouped_violations.keys()];
		rule_ids.sort();
		const staging_directory = this._file_io.temporary_directory(dirname(this._root), "ai-code-guard-task-");
		const staged_rules = join(staging_directory, "rules");
		try {
			this._documentation.stage_rule_docs(rule_ids, staged_rules, this._documents);
			this._batch.replace({ staged_rules, rule_ids, issues: content, documents });
		} finally {
			this._file_io.remove_path(staging_directory);
		}
	}
}
