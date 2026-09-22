import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

	/** Responsibilities: _task workspace path management_. **/
export class TaskWorkspace {
	private readonly workspace_root: string;
	private readonly rules_root: string;
	public readonly issues_file: string;
	public readonly report_file: string;

	/** Responsibilities: _initialization task workspace paths_. **/
	public constructor(root: string) {
		this.workspace_root = resolve(root, '.ai-code-guard');
		this.rules_root = join(this.workspace_root, 'rules');
		this.issues_file = join(this.workspace_root, 'issues.md');
		this.report_file = join(this.workspace_root, 'report.md');
	}

	/** Responsibilities: _current task issue cleanup_. **/
	public clear_batch(): void {
		mkdirSync(this.workspace_root, { recursive: true });
		rmSync(this.rules_root, { recursive: true, force: true });
		mkdirSync(this.rules_root, { recursive: true });
		rmSync(join(this.workspace_root, 'issues.md'), { force: true });
		rmSync(this.report_file, { force: true });
	}

	/** Responsibilities: _output current issue markdown_. **/
	public write_issues(content: string): void {
		mkdirSync(this.workspace_root, { recursive: true });
		const output = `${content}\n`;
		writeFileSync(this.issues_file, output, 'utf8');
	}

	/** Responsibilities: _output current lint reporting_. **/
	public write_report(content: string): void {
		mkdirSync(this.workspace_root, { recursive: true });
		writeFileSync(this.report_file, `${content}\n`, 'utf8');
	}

	/** Responsibilities: _resolution documentation path rule_. **/
	public rule_document_path(rule_id: string): string {
		return join(this.rules_root, `${rule_id}.md`);
	}

}
