import { MARKDOWN_TEXT_SUFFIXES } from "src/constants";

/** Responsibilities: _Markdown fence masking_, _prose line selection_. **/
export class MarkdownProseLines {
	private readonly file: string;
	private readonly text: string;

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
		const marker = this.fence_marker(lines[index]);
		if (marker.length === 0) {
			if (active_marker.length > 0) {
				lines[index] = "";
			}
			return active_marker;
		}
		if (active_marker.length === 0) {
			active_marker = marker;
		} else if (marker === active_marker) {
			active_marker = "";
		}
		lines[index] = "";
		return active_marker;
	}

	/** Responsibilities: _Markdown source ownership_. **/
	public constructor(file: string, text: string) {
		this.file = file;
		this.text = text;
	}

	/** Responsibilities: _fenced code removal_. **/
	public outside_fenced_code(): string[] {
		const lines = this.text.split("\n");
		let active_marker = "";
		for (let index = 0; index < lines.length; index += 1) {
			active_marker = this.consume_line(lines, index, active_marker);
		}
		return lines;
	}

	/** Responsibilities: _Markdown prose line selection_. **/
	public prose_lines(): string[] {
		const extension_start = this.file.lastIndexOf(".");
		const extension = this.file.slice(extension_start).toLowerCase();
		if (MARKDOWN_TEXT_SUFFIXES.has(extension)) {
			return this.outside_fenced_code();
		}
		return this.text.split("\n");
	}
}
