import type { MarkdownTemplateContract } from "src/core/support/task/review-agent/protocols";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _Markdown template loading_, _placeholder rendering_. **/
export class MarkdownTemplate implements MarkdownTemplateContract {
	private readonly _file: string;
	private readonly _content: string;

	/** Responsibilities: _Markdown template initialization_. **/
	public constructor(file: string, io: IOContract) {
		if (!io.file(file).path_exists()) {
			throw new Error(`Markdown template is missing: ${file}`);
		}
		this._file = file;
		this._content = io.file(file).file_text().trim();
	}

	/** Responsibilities: _Markdown placeholder discovery_. **/
	public placeholders(): readonly string[] {
		const placeholders = this._content.match(/\{\{[^{}]+\}\}|\{[^{}]+\}/gu);
		if (placeholders === null) {
			return [];
		}
		return placeholders;
	}

	/** Responsibilities: _Markdown placeholder rendering_. **/
	public render(placeholder: string, value: string): string {
		if (!this.placeholders().includes(placeholder)) {
			throw new Error(`Markdown template ${this._file} is missing ${placeholder}.`);
		}
		return this.render_text(this._content, new Map([[placeholder, value]]));
	}

	/** Responsibilities: _multiple Markdown placeholder rendering_. **/
	public render_all(values: ReadonlyMap<string, string>): string {
		return this.render_text(this._content, values);
	}

	/** Responsibilities: _Markdown content rendering_. **/
	public render_text(content: string, values: ReadonlyMap<string, string>): string {
		let rendered = content;
		for (const [placeholder, value] of values) {
			rendered = rendered.replaceAll(placeholder, value);
		}
		return rendered;
	}
}
