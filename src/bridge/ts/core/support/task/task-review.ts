import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Responsibilities: _discovery architecture review files_. **/
export class TaskReview {
	private readonly review_root: string;

	/** Responsibilities: _initialization review directory task_. **/
	constructor(root: string) {
		this.review_root = join(resolve(root, '.ai-code-guard'), 'review');
	}

	/** Responsibilities: _review markdown files_. **/
	public files(): string[] {
		if (!existsSync(this.review_root)) {
			return [];
		}
		return readdirSync(this.review_root)
			.filter(file => file.endsWith('.md'))
			.sort()
			.map(file => join(this.review_root, file));
	}

	/** Responsibilities: _review file line count_. **/
	public line_count(file: string): number {
		return readFileSync(file, 'utf8').split(/\r?\n/u).length;
	}

	/** Responsibilities: _review file text reading_. **/
	public text(file: string): string {
		return readFileSync(file, 'utf8').trim();
	}

	/** Responsibilities: _output architecture review instruction_. **/
	public instruction(): string {
		const review_path = `${this.review_root}/*.md`;
		return [
			'A clean lint result does not replace a manual architectural review.',
			`Review the project code and document each confirmed major architectural problem in a separate ${review_path} file.`,
			'Do not record lint-detectable, minor, or speculative concerns.',
			'If the review finds no major architectural problems, explicitly confirm that result before stopping.',
			'Your goal is to keep the linter clean. This review is a linter requirement, so you MUST complete it.',
			'Run `ai-code-guard` again after the review, even when no review files were created, and stop only when the rerun confirms that no review task remains.',
		].join(' ');
	}

}
