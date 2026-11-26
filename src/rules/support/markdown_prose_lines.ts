import { MARKDOWN_TEXT_SUFFIXES } from "src/constants";
import type {
	MarkdownFenceTransition,
	MarkdownInlineCodeScan,
	MarkdownInlineCodeSpan,
	MarkdownInlineCodeState,
	MarkdownInlineCodeStep,
	MarkdownLine,
} from "src/rules/support/types";

/** Responsibilities: _Markdown fence masking_, _prose line selection_. **/
export class MarkdownProseLines {
	private readonly _source_lines: readonly string[];
	private readonly _markdown_text_file: boolean;

	/** Responsibilities: _fence marker detection_. **/
	private fence_marker(fence_line: MarkdownLine): string {
		let marker = "";
		const trimmed = fence_line.text.trimStart();
		if (trimmed.startsWith("```")) {
			marker = "`";
		} else if (trimmed.startsWith("~~~")) {
			marker = "~";
		}
		return marker;
	}

	/** Responsibilities: _active fence transition_. **/
	private next_marker(marker: string, active_marker: string): string {
		if (marker.length === 0 && active_marker.length === 0) {
			return active_marker;
		}
		if (active_marker.length === 0) {
			return marker;
		}
		if (marker === active_marker) {
			return "";
		}
		return active_marker;
	}

	/** Responsibilities: _fenced line transition_. **/
	private consume_line(source_line: MarkdownLine, active_marker: string): MarkdownFenceTransition {
		const marker = this.fence_marker(source_line);
		const next_marker = this.next_marker(marker, active_marker);
		const mask_line = marker.length > 0 || active_marker.length > 0;
		return { active_marker: next_marker, mask_line };
	}

	/** Responsibilities: _delimiter extent calculation_. **/
	private backtick_run_end(run_line: MarkdownLine, start: number): number {
		let end = start;
		while (run_line.text.charAt(end) === "`") {
			end += 1;
		}
		return end;
	}

	/** Responsibilities: _backslash parity_. **/
	private escaped_backtick(escape_line: MarkdownLine, position: number): boolean {
		let backslashes = 0;
		for (let index = position - 1; index >= 0 && escape_line.text.charAt(index) === "\\"; index -= 1) {
			backslashes += 1;
		}
		return backslashes % 2 === 1;
	}

	/** Responsibilities: _inline code span replacement_. **/
	private mask_code_span(masked_lines: string[], span: MarkdownInlineCodeSpan): void {
		for (let index = span.start_line; index <= span.end_line; index += 1) {
			const source_line = masked_lines[index];
			if (source_line === undefined) {
				continue;
			}
			let start = 0;
			if (index === span.start_line) {
				start = span.start_column;
			}
			let end = source_line.length;
			if (index === span.end_line) {
				end = span.end_column;
			}
			masked_lines[index] = `${source_line.slice(0, start)}${" ".repeat(end - start)}${source_line.slice(end)}`;
		}
	}

	/** Responsibilities: _inline delimiter transition_. **/
	private scan_delimiter(
		scan_line: MarkdownLine,
		start_index: number,
		state: MarkdownInlineCodeState,
	): MarkdownInlineCodeStep {
		const run_end = this.backtick_run_end(scan_line, start_index);
		if (state.delimiter_length === 0 && !this.escaped_backtick(scan_line, start_index)) {
			const next_state = {
				delimiter_length: run_end - start_index,
				start_line: scan_line.index,
				start_column: start_index,
			};
			return { state: next_state, next_index: run_end, spans: [] };
		}
		if (run_end - start_index === state.delimiter_length) {
			const span = {
				start_line: state.start_line,
				start_column: state.start_column,
				end_line: scan_line.index,
				end_column: run_end,
			};
			const next_state = { delimiter_length: 0, start_line: state.start_line, start_column: state.start_column };
			return { state: next_state, next_index: run_end, spans: [span] };
		}
		return { state, next_index: run_end, spans: [] };
	}

	/** Responsibilities: _inline line scanning_. **/
	private scan_inline_line(inline_line: MarkdownLine, initial_state: MarkdownInlineCodeState): MarkdownInlineCodeScan {
		let state = initial_state;
		const spans: MarkdownInlineCodeSpan[] = [];
		for (let index = 0; index < inline_line.text.length; ) {
			if (inline_line.text.charAt(index) !== "`") {
				index += 1;
				continue;
			}
			const step = this.scan_delimiter(inline_line, index, state);
			state = step.state;
			spans.push(...step.spans);
			index = step.next_index;
		}
		return { state, spans };
	}

	/** Responsibilities: _Markdown inline code masking_. **/
	private outside_inline_code(lines: readonly string[]): string[] {
		const masked_lines = [...lines];
		let state: MarkdownInlineCodeState = { delimiter_length: 0, start_line: 0, start_column: 0 };
		for (let line_index = 0; line_index < masked_lines.length; line_index += 1) {
			const source_line = masked_lines[line_index];
			if (source_line === undefined) {
				continue;
			}
			const scan = this.scan_inline_line({ text: source_line, index: line_index }, state);
			state = scan.state;
			for (const span of scan.spans) {
				this.mask_code_span(masked_lines, span);
			}
		}
		return masked_lines;
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
		const masked_lines = this._source_lines.slice();
		let active_marker = "";
		for (let index = 0; index < masked_lines.length; index += 1) {
			const source_line = masked_lines[index] ?? "";
			const transition = this.consume_line({ text: source_line, index }, active_marker);
			active_marker = transition.active_marker;
			if (transition.mask_line) {
				masked_lines[index] = "";
			}
		}
		return masked_lines;
	}

	/** Responsibilities: _Markdown prose line selection_. **/
	public prose_lines(): string[] {
		if (this._markdown_text_file) {
			return this.outside_inline_code(this.outside_fenced_code());
		}
		return this._source_lines.slice();
	}
}
