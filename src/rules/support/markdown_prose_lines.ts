import { MARKDOWN_TEXT_SUFFIXES } from "src/constants";

type InlineCodeState = { active_delimiter: number; start_line: number; start_column: number };

/** Responsibilities: _Markdown fence masking_, _prose line selection_. **/
export class MarkdownProseLines {
	private readonly _source_lines: readonly string[];
	private readonly _markdown_text_file: boolean;

	/** Responsibilities: _Markdown fence recognition_. **/
	private fence_marker(line: string): string {
		const trimmed = line.trimStart();
		if (trimmed.startsWith("```")) {
			return "`";
		}
		if (trimmed.startsWith("~~~")) {
			return "~";
		}
		return "";
	}

	/** Responsibilities: _fenced Markdown line masking_. **/
	private consume_line(lines: string[], index: number, active_marker: string): string {
		const line = lines[index];
		if (line === undefined) {
			return active_marker;
		}
		const marker = this.fence_marker(line);
		if (marker.length === 0 && active_marker.length === 0) {
			return active_marker;
		}
		lines[index] = "";
		if (active_marker.length === 0) {
			return marker;
		}
		if (marker === active_marker) {
			return "";
		}
		return active_marker;
	}

	/** Responsibilities: _Markdown backtick run boundary_. **/
	private backtick_run_end(line: string, start: number): number {
		let end = start;
		while (line.charAt(end) === "`") {
			end += 1;
		}
		return end;
	}

	/** Responsibilities: _Markdown escaped delimiter detection_. **/
	private escaped_backtick(line: string, position: number): boolean {
		let backslashes = 0;
		for (let index = position - 1; index >= 0 && line.charAt(index) === "\\"; index -= 1) {
			backslashes += 1;
		}
		return backslashes % 2 === 1;
	}

	/** Responsibilities: _inline code span replacement_. **/
	private mask_code_span(
		lines: string[],
		start_line: number,
		start_column: number,
		end_line: number,
		end_column: number,
	): void {
		for (let index = start_line; index <= end_line; index += 1) {
			const line = lines[index];
			if (line === undefined) {
				continue;
			}
			const start = index === start_line ? start_column : 0;
			const end = index === end_line ? end_column : line.length;
			lines[index] = `${line.slice(0, start)}${" ".repeat(end - start)}${line.slice(end)}`;
		}
	}

	/** Responsibilities: _Markdown inline code masking_. **/
	private mask_inline_code_line(lines: string[], line_index: number, line: string, state: InlineCodeState): void {
		for (let index = 0; index < line.length; ) {
			if (line.charAt(index) !== "`") {
				index += 1;
				continue;
			}
			const run_end = this.backtick_run_end(line, index);
			if (state.active_delimiter === 0) {
				if (!this.escaped_backtick(line, index)) {
					state.active_delimiter = run_end - index;
					state.start_line = line_index;
					state.start_column = index;
				}
				index = run_end;
				continue;
			}
			if (run_end - index === state.active_delimiter) {
				this.mask_code_span(lines, state.start_line, state.start_column, line_index, run_end);
				state.active_delimiter = 0;
			}
			index = run_end;
		}
	}

	/** Responsibilities: _Markdown inline code masking_. **/
	private outside_inline_code(lines: readonly string[]): string[] {
		const prose_lines = [...lines];
		const state: InlineCodeState = { active_delimiter: 0, start_line: 0, start_column: 0 };
		for (let line_index = 0; line_index < prose_lines.length; line_index += 1) {
			const line = prose_lines[line_index];
			if (line !== undefined) {
				this.mask_inline_code_line(prose_lines, line_index, line, state);
			}
		}
		return prose_lines;
	}

	/** Responsibilities: _Markdown source ownership_. **/
	public constructor(file: string, text: string) {
		const extension_start = file.lastIndexOf(".");
		const extension = file.slice(extension_start).toLowerCase();
		this._source_lines = text.split("\n");
		this._markdown_text_file = MARKDOWN_TEXT_SUFFIXES.has(extension);
	}

	/** Responsibilities: _fenced code removal_. **/
	public outside_fenced_code(): string[] {
		const lines = this._source_lines.slice();
		let active_marker = "";
		for (let index = 0; index < lines.length; index += 1) {
			active_marker = this.consume_line(lines, index, active_marker);
		}
		return lines;
	}

	/** Responsibilities: _Markdown prose line selection_. **/
	public prose_lines(): string[] {
		if (this._markdown_text_file) {
			return this.outside_inline_code(this.outside_fenced_code());
		}
		return this._source_lines.slice();
	}
}
