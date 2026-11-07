import { TaskIssueSourceFile } from "src/core/support/task/reporting/workspace/task_issue_source_file";
import type { ViolationContract } from "src/reporting_protocols";
import type {
	TaskIssueRuleSectionContract,
	TaskIssueRuleSectionOptions,
	TaskIssueSourceFileContract,
} from "src/task_protocols";
import type { TaskIssueFileViolationDetails } from "src/types";

/** Responsibilities: _one rule issue section_, _source-specific diagnostics_. **/
export class TaskIssueRuleSection implements TaskIssueRuleSectionContract {
	private readonly _options: TaskIssueRuleSectionOptions;

	/** Responsibilities: _source file violation groups_. **/
	private grouped_files(): Map<string, ViolationContract[]> {
		const groups = new Map<string, ViolationContract[]>();
		for (const violation of this._options.violations) {
			const source_file = new TaskIssueSourceFile(
				this._options.root,
				violation.file(),
				this._options.file_io,
				this._options.boundary_failures,
			);
			const path = source_file.absolute_path();
			let group = groups.get(path);
			if (group === undefined) {
				group = [];
				groups.set(path, group);
			}
			group.push(violation);
		}
		return groups;
	}

	/** Responsibilities: _source line diagnostics_. **/
	private file_violation_lines(
		source_file: TaskIssueSourceFileContract,
		violation: ViolationContract,
		details: TaskIssueFileViolationDetails,
	): string[] {
		const violation_lines = [`- Line ${violation.line()}: ${source_file.source_line(violation.line())}`];
		if (details.single_violation || details.messages.size > 1) {
			violation_lines.push(`Problem: ${violation.message()}`);
		}
		if (details.single_violation || details.hints.size > 1) {
			violation_lines.push(`Hint: ${violation.hint()}`);
		}
		return violation_lines;
	}

	/** Responsibilities: _source file diagnostic lines_. **/
	private file_violations(
		file: string,
		file_violations: ViolationContract[],
		details: TaskIssueFileViolationDetails,
	): string[] {
		const source_file = new TaskIssueSourceFile(
			this._options.root,
			file,
			this._options.file_io,
			this._options.boundary_failures,
		);
		const rendered_lines: string[] = [];
		for (const violation of file_violations.sort((left, right) => left.line() - right.line())) {
			if (!Number.isInteger(violation.line())) {
				throw new Error(`Invalid diagnostic line ${violation.line()} for ${this._options.rule_id} in ${file}.`);
			}
			rendered_lines.push(...this.file_violation_lines(source_file, violation, details));
		}
		return rendered_lines;
	}

	/** Responsibilities: _source file section rendering_. **/
	private file_sections(): string[] {
		const groups = this.grouped_files();
		const ordered_files = [...groups.entries()];
		ordered_files.sort(([left], [right]) => left.localeCompare(right));
		const messages = new Set(this._options.violations.map((violation) => violation.message()));
		const hints = new Set(this._options.violations.map((violation) => violation.hint()));
		const details = {
			messages,
			hints,
			single_violation: this._options.violations.length === 1,
		};
		const section_lines: string[] = [];
		for (const [file, file_violations] of ordered_files) {
			section_lines.push("", `## ${file}`, ...this.file_violations(file, file_violations, details));
		}
		return section_lines;
	}

	/** Responsibilities: _directory issue rendering_. **/
	private directory_section(): string {
		const read_path = this._options.documents.rule_document_path(this._options.rule_id);
		const lines = [`# ${this._options.rule_id}`, `Read \`${read_path}\`.`];
		for (const violation of this._options.violations) {
			const source_file = new TaskIssueSourceFile(
				this._options.root,
				violation.file(),
				this._options.file_io,
				this._options.boundary_failures,
			);
			lines.push(`Hint: ${violation.hint()}`, `## ${source_file.absolute_path()}`, `Problem: ${violation.message()}`);
		}
		return lines.join("\n");
	}

	/** Responsibilities: _shared rule message selection_. **/
	private description_lines(first: ViolationContract): string[] {
		const messages = new Set(this._options.violations.map((violation) => violation.message()));
		const hints = [...new Set(this._options.violations.map((violation) => violation.hint()))];
		const lines: string[] = [];
		if (this._options.violations.length > 1 && messages.size === 1) {
			lines.push(`Problem: ${first.message()}`);
		}
		if (this._options.violations.length > 1 && hints.length === 1) {
			lines.push(`Hint: ${hints[0]}`);
		}
		return lines;
	}

	/** Responsibilities: _task issue section initialization_. **/
	public constructor(options: TaskIssueRuleSectionOptions) {
		this._options = options;
	}

	/** Responsibilities: _rule issue formatting_. **/
	public format(): string {
		const source_file = new TaskIssueSourceFile(
			this._options.root,
			this._options.first.file(),
			this._options.file_io,
			this._options.boundary_failures,
		);
		if (source_file.directory()) {
			return this.directory_section();
		}
		const read_path = this._options.documents.rule_document_path(this._options.rule_id);
		const lines = [
			`# ${this._options.rule_id}`,
			`Read \`${read_path}\`.`,
			...this.description_lines(this._options.first),
		];
		lines.push(...this.file_sections());
		return lines.join("\n");
	}
}
