import { MARKDOWN_TEXT_SUFFIXES } from "src/constants";

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
			return this.outside_fenced_code();
		}
		return this._source_lines.slice();
	}
}
