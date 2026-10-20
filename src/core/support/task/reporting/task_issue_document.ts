import { dirname, isAbsolute, join, resolve } from "node:path";
import { SOURCE_UNAVAILABLE } from "src/core/support/task/constants";
import { TaskRuleLanguageGroups } from "src/core/support/task/reporting/task_rule_language_groups";
import type { TaskSourceText } from "src/core/support/task/types";
import type { TaskBatchReplacementContract, TaskIssueDocumentContract, TaskRuleDocumentationContract, TaskWorkspaceDocumentsContract } from "src/task_protocols";
import type { ReportViolation } from "src/reporting_protocols";
import type { TaskWorkspaceDocument } from "src/task_types";
import type { TaskIssueFileViolationDetails } from "src/types";
import type { IOContract } from "src/io/protocols";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";

/** Responsibilities: _issue formatting_, _source context_. **/
export class TaskIssueDocument implements TaskIssueDocumentContract {
	private readonly root: string;
	private readonly documents: TaskWorkspaceDocumentsContract;
	private readonly batch: TaskBatchReplacementContract;
	private readonly documentation: TaskRuleDocumentationContract;
	private readonly file_io: IOContract;
	private readonly boundary_failures: BoundaryFailureClassifier;

	/** Responsibilities: _source text loading_. **/
	private source_text(file: string): TaskSourceText {
		try {
			const absolute_file = this.absolute_file(file);
			if (!this.file_io.directory_entries.path_is_file(absolute_file)) {
				return { available: false, lines: [] };
			}
			return { available: true, lines: this.file_io.file_content.file_text(absolute_file).split(/\r?\n/u) };
		} catch (error) {
			if (!this.boundary_failures.system_failure_message(String(error))) {
				throw error;
			}
			return { available: false, lines: [] };
		}
	}

	/** Responsibilities: _source line formatting_. **/
	private source_line(file: string, line: number): string {
		const source = this.source_text(file);
		if (!source.available) {
			return SOURCE_UNAVAILABLE;
		}
		const index = line - 1;
		const before_start = index < 0;
		const after_end = index >= source.lines.length;
		if (before_start || after_end) {
			return "";
		}
		return source.lines[index].trim();
	}

	/** Responsibilities: _resolution reporting file path_. **/
	private absolute_file(file: string): string {
		if (isAbsolute(file)) {
			return file;
		}
		return resolve(this.root, file);
	}

	/** Responsibilities: _directory diagnostic classification_. **/
	private is_directory(file: string): boolean {
		try {
			return this.file_io.directory_entries.path_is_directory(this.absolute_file(file));
		} catch (error) {
			if (!this.boundary_failures.system_failure_message(String(error))) {
				throw error;
			}
			return false;
		}
	}

	/** Responsibilities: _group reporting violations source_. **/
	private grouped_files(violations: readonly ReportViolation[]): Map<string, ReportViolation[]> {
		const groups = new Map<string, ReportViolation[]>();
		for (const violation of violations) {
			const file = this.absolute_file(violation.file);
			let group = groups.get(file);
			if (group === undefined) {
				group = [];
				groups.set(file, group);
			}
			group.push(violation);
		}
		return groups;
	}

	/** Responsibilities: _file violation line rendering_. **/
	private append_file_violations(
		lines: string[],
		file: string,
		file_violations: ReportViolation[],
		details: TaskIssueFileViolationDetails,
	): void {
		for (const violation of file_violations.sort((left, right) => left.line - right.line)) {
			lines.push(`- Line ${violation.line}: ${this.source_line(file, violation.line)}`);
			const has_multiple_messages = details.messages.size > 1;
			const has_multiple_hints = details.hints.size > 1;
			if (details.single_violation || has_multiple_messages) {
				lines.push(`Problem: ${violation.message}`);
			}
			if (details.single_violation || has_multiple_hints) {
				lines.push(`Hint: ${violation.hint}`);
			}
		}
	}

	/** Responsibilities: _aggregation source-file sections_. **/
	private append_file_sections(
		lines: string[],
		violations: readonly ReportViolation[],
		messages: ReadonlySet<string>,
		hints: ReadonlySet<string>,
		single_violation: boolean,
	): void {
		const files = this.grouped_files(violations);
		const ordered_files = [...files.entries()];
		ordered_files.sort(([left], [right]) => left.localeCompare(right));
		const details = { messages, hints, single_violation };
		for (const [file, file_violations] of ordered_files) {
			lines.push("", `## ${file}`);
			this.append_file_violations(lines, file, file_violations, details);
		}
	}

	/** Responsibilities: _directory-level violation section formatting_. **/
	private directory_section(rule_id: string, violations: readonly ReportViolation[]): string {
		const read_path = this.documents.rule_document_path(rule_id);
		const lines = [`# ${rule_id}`, `Read \`${read_path}\`.`];
		for (const violation of violations) {
			lines.push(
				`Hint: ${violation.hint}`,
				`## ${this.absolute_file(violation.file)}`,
				`Problem: ${violation.message}`,
			);
		}
		return lines.join("\n");
	}

	/** Responsibilities: _shared line-specific rule formatting_. **/
	private rule_description_lines(first: ReportViolation, violations: readonly ReportViolation[]): string[] {
		const messages = new Set(violations.map((violation) => violation.message));
		const hints = [...new Set(violations.map((violation) => violation.hint))];
		const problem_lines: string[] = [];
		const has_multiple_violations = violations.length > 1;
		const has_one_message = messages.size === 1;
		const has_one_hint = hints.length === 1;
		if (has_multiple_violations && has_one_message) {
			problem_lines.push(`Problem: ${first.message}`);
		}
		if (has_multiple_violations && has_one_hint) {
			problem_lines.push(`Hint: ${hints[0]}`);
		}
		return problem_lines;
	}

	/** Responsibilities: _rule section grouped formatting_. **/
	private rule_section(rule_id: string, violations: readonly ReportViolation[]): string {
		if (violations.length === 0) {
			return "";
		}
		const first = violations[0];
		if (this.is_directory(first.file)) {
			return this.directory_section(rule_id, violations);
		}
		const messages = new Set(violations.map((violation) => violation.message));
		const hints = new Set(violations.map((violation) => violation.hint));
		const lines = [
			`# ${rule_id}`,
			`Read \`${this.documents.rule_document_path(rule_id)}\`.`,
			...this.rule_description_lines(first, violations),
		];
		this.append_file_sections(lines, violations, messages, hints, violations.length === 1);
		return lines.join("\n");
	}

	/** Responsibilities: _architecture review section_. **/
	private review_section(review_files: readonly string[]): string {
		if (review_files.length === 0) {
			return "";
		}
		const review_lines = ["# Unresolved architecture review files", ...review_files.map((file) => `- ${file}`)];
		return review_lines.join("\n");
	}

	/** Responsibilities: _rule sections composition_. **/
	private rule_sections(groups: ReadonlyMap<string, readonly ReportViolation[]>): string {
		const ordered_groups = [...groups.entries()];
		ordered_groups.sort(([left], [right]) => left.localeCompare(right));
		const sections = ordered_groups.map(([rule_id, group]) => this.rule_section(rule_id, group));
		return sections.join("\n\n");
	}

	/** Responsibilities: _initialization workspace paths task_. **/
	public constructor(
		root: string,
		documents: TaskWorkspaceDocumentsContract,
		batch: TaskBatchReplacementContract,
		documentation: TaskRuleDocumentationContract,
		file_io: IOContract,
	) {
		this.root = root;
		this.documents = documents;
		this.batch = batch;
		this.documentation = documentation;
		this.file_io = file_io;
		this.boundary_failures = new BoundaryFailureClassifier();
	}

	/** Responsibilities: _reporting violations task rendering_. **/
	public format(violations: readonly ReportViolation[], review_files: readonly string[]): string {
		const rule_language_groups = new TaskRuleLanguageGroups(violations);
		const rule_sections = this.rule_sections(rule_language_groups.grouped_violations());
		const review_section = this.review_section(review_files);
		return [rule_sections, review_section].filter((section) => section.length > 0).join("\n\n");
	}

	/** Responsibilities: _output formatting issue document_. **/
	public write(
		violations: readonly ReportViolation[],
		review_files: readonly string[],
		documents: ReadonlyMap<TaskWorkspaceDocument, string>,
	): void {
		const content = this.format(violations, review_files);
		const rule_language_groups = new TaskRuleLanguageGroups(violations);
		const grouped_violations = rule_language_groups.grouped_violations();
		const rule_ids = [...grouped_violations.keys()];
		rule_ids.sort();
		const staging_directory = this.file_io.directory_operations.temporary_directory(
			dirname(this.root),
			"ai-code-guard-task-",
		);
		const staged_rules = join(staging_directory, "rules");
		try {
			this.documentation.stage_rule_docs(rule_ids, staged_rules, this.documents);
			this.batch.replace({ staged_rules, rule_ids, issues: content, documents });
		} finally {
			this.file_io.directory_operations.remove_path(staging_directory);
		}
	}
}
