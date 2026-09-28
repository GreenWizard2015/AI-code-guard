import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import type { TaskDocumentationProtocol } from 'src/protocols';

/** Responsibilities: _discovery architecture review files_. **/
export class TaskReview {
	private readonly review_root: string;
	private readonly documentation: TaskDocumentationProtocol;
	private readonly review_code = this.completion_code(new Date());

	/** Responsibilities: _review completion code creation_. **/
	private completion_code(timestamp: Date): string {
		const minute = [
			timestamp.getFullYear().toString().padStart(4, '0'),
			(timestamp.getMonth() + 1).toString().padStart(2, '0'),
			timestamp.getDate().toString().padStart(2, '0'),
			timestamp.getHours().toString().padStart(2, '0'),
			timestamp.getMinutes().toString().padStart(2, '0'),
		].join('');
		const display = `${minute.slice(0, 4)}-${minute.slice(4, 6)}-${minute.slice(6, 8)} ${minute.slice(8, 10)}:${minute.slice(10, 12)}`;
		const hash = createHash('md5').update(minute).digest('hex');
		return `Architecture review completion code: ${hash} ${display}`;
	}

	/** Responsibilities: _initialization review directory task_. **/
	constructor(root: string, documentation: TaskDocumentationProtocol) {
		this.review_root = join(resolve(root, '.ai-code-guard'), 'review');
		this.documentation = documentation;
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
		const instruction = this.documentation.architecture_review(review_path, this.review_code);
		if (!instruction.includes(this.review_code)) {
			throw new Error('Architecture review instruction omitted its completion code.');
		}
		return instruction;
	}

	/** Responsibilities: _architecture review completion verification_. **/
	public completed(): boolean {
		return this.files().some(file => this.text(file).includes(this.review_code));
	}

}
