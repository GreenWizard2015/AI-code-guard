import { isAbsolute, resolve } from 'node:path';
import { readFileSync, statSync } from 'node:fs';
import type { ReportViolation } from 'src/bridge/ts/core/types';
import { TaskWorkspace } from 'src/bridge/ts/core/support/task/task-workspace';
import { TaskDocumentation } from 'src/bridge/ts/core/support/task/task-documentation';

/** Responsibilities: _grouped lint violations formatting_. **/
export class TaskIssueDocument {
	private readonly root: string;
	private readonly workspace: TaskWorkspace;
	private readonly documentation: TaskDocumentation;

	/** Responsibilities: _source line formatting_. **/
	private source_line(file: string, line: number): string {
		const absolute_file = this.absolute_file(file);
		if (!statSync(absolute_file).isFile()) {
			return '(directory-level diagnostic)';
		}
		const source = readFileSync(absolute_file, 'utf8').split(/\r?\n/u);
		const index = line - 1;
		if (index < 0 || index >= source.length) {
			return '';
		}
		return source[index].trim();
	}

	/** Responsibilities: _resolution reporting file path_. **/
	private absolute_file(file: string): string {
		if (isAbsolute(file)) {
			return file;
		}
		return resolve(this.root, file);
	}

	/** Responsibilities: _group reporting violations rule_. **/
	private grouped_rules(violations: readonly ReportViolation[]): Map<string, ReportViolation[]> {
		const groups = new Map<string, ReportViolation[]>();
		for (const violation of violations) {
			let group = groups.get(violation.rule_id);
			if (group === undefined) {
				group = [];
				groups.set(violation.rule_id, group);
			}
			group.push(violation);
		}
		return groups;
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

	/** Responsibilities: _aggregation source-file sections their_. **/
	private append_file_sections(
		lines: string[],
		violations: readonly ReportViolation[],
		messages: ReadonlySet<string>,
		hints: ReadonlySet<string>,
		single_violation: boolean,
	): void {
		const files = this.grouped_files(violations);
		for (const [file, file_violations] of [...files.entries()].sort(([left], [right]) => left.localeCompare(right))) {
			lines.push('', `## ${file}`);
			for (const violation of file_violations.sort((left, right) => left.line - right.line)) {
				lines.push(`- Line ${violation.line}: ${this.source_line(file, violation.line)}`);
				if (single_violation || messages.size > 1) {
					lines.push(`Problem: ${violation.message}`);
				}
				if (single_violation || hints.size > 1) {
					lines.push(`Hint: ${violation.hint}`);
				}
			}
		}
	}

	/** Responsibilities: _directory-level violation section formatting_. **/
	private directory_section(rule_id: string, violation: ReportViolation): string {
		const file = violation.file;
		const directory = this.absolute_file(file);
		const read_path = this.workspace.rule_document_path(rule_id);
		const lines = [
			`# ${rule_id}`,
			`Read \`${read_path}\`.`,
			`Hint: ${violation.hint}`,
			`## ${directory}`,
			`Problem: ${violation.message}`,
		];
		return lines.join('\n');
	}

	/** Responsibilities: _shared line-specific rule formatting_. **/
	private rule_description_lines(
		first: ReportViolation,
		violations: readonly ReportViolation[],
	): string[] {
		const messages = new Set(violations.map(violation => violation.message));
		const hints = [...new Set(violations.map(violation => violation.hint))];
		const problem_lines: string[] = [];
		if (violations.length > 1 && messages.size === 1) {
			problem_lines.push(`Problem: ${first.message}`);
		}
		if (violations.length > 1 && hints.length === 1) {
			problem_lines.push(`Hint: ${hints[0]}`);
		}
		return problem_lines;
	}

	/** Responsibilities: _rule section grouped formatting_. **/
	private rule_section(rule_id: string, violations: readonly ReportViolation[]): string {
		if (violations.length === 0) {
			return '';
		}
		const first = violations[0];
		if (statSync(this.absolute_file(first.file)).isDirectory()) {
			return this.directory_section(rule_id, first);
		}
		const messages = new Set(violations.map(violation => violation.message));
		const hints = new Set(violations.map(violation => violation.hint));
		const lines = [
			`# ${rule_id}`,
			`Read \`${this.workspace.rule_document_path(rule_id)}\`.`,
			...this.rule_description_lines(first, violations),
		];
		this.append_file_sections(lines, violations, messages, hints, violations.length === 1);
		return lines.join('\n');
	}

	/** Responsibilities: _initialization workspace paths task_. **/
	public constructor(root: string, workspace: TaskWorkspace, documentation: TaskDocumentation) {
		this.root = root;
		this.workspace = workspace;
		this.documentation = documentation;
	}

	/** Responsibilities: _reporting violations task rendering_. **/
	public format(violations: readonly ReportViolation[]): string {
		return [...this.grouped_rules(violations).entries()]
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([rule_id, group]) => this.rule_section(rule_id, group))
			.join('\n\n');
	}

	/** Responsibilities: _output formatting issue document_. **/
	public write(violations: readonly ReportViolation[]): void {
		this.workspace.clear_batch();
		const rule_ids = [...new Set(violations.map(violation => violation.rule_id))].sort();
		this.documentation.copy_rule_documents(rule_ids, this.workspace);
		this.workspace.write_issues(this.format(violations));
	}
}
