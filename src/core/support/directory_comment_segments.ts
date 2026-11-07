import type { AstSourceSpan } from "src/model/ast/normalized_ast_types";
import type {
	CommentLineScan,
	CommentLineScannerContract,
	DirectoryCommentSegmentsContract,
} from "src/shared_services_protocols";
import type { CommentScanOptions, CommentScanResult, SourceRange } from "src/types";
import type { CommentSegment } from "src/types";

/** Responsibilities: _comment segment parsing_, _source line metric calculation_. **/
export class DirectoryCommentSegments implements DirectoryCommentSegmentsContract, CommentLineScannerContract {
	private readonly _block_comment_start: string;
	private readonly _block_comment_end: string;
	private readonly _python_line_comment: string;
	private readonly _typescript_line_comment: string;

	/** Responsibilities: _classification next comment code_. **/
	private next_comment_segment(segment_text: string, options: CommentScanOptions): CommentSegment {
		if (options.in_block_comment) {
			return this.process_block_segment(segment_text);
		}
		return this.process_code_segment(segment_text, this.line_comment_marker(options.python));
	}

	/** Responsibilities: _consume block-comment segment reporting_. **/
	private process_block_segment(block_comment_segment: string): CommentSegment {
		const remainder = this.close_block_comment(block_comment_segment);
		if (remainder.length === 0) {
			return { text: "", in_block_comment: true, result: { text: "", in_block_comment: true }, complete: false };
		}
		return { text: remainder, in_block_comment: false, result: { text: "", in_block_comment: false }, complete: false };
	}

	/** Responsibilities: _consume line-comment segment output_. **/
	private process_line_segment(source_line: string, line_comment: number): CommentSegment {
		const code = source_line.slice(0, line_comment);
		const result: CommentScanResult = {
			text: code,
			in_block_comment: false,
		};
		return { text: "", in_block_comment: false, result, complete: true };
	}

	/** Responsibilities: _consume code segment up_. **/
	private process_code_segment(code_segment: string, marker: string): CommentSegment {
		const block = code_segment.indexOf(this._block_comment_start);
		const line_comment = this.line_comment_index(code_segment, marker);
		if (block < 0 || line_comment < block) {
			return this.process_line_segment(code_segment, line_comment);
		}
		const end = code_segment.indexOf(this._block_comment_end, block + this._block_comment_start.length);
		if (end >= 0) {
			return {
				text: code_segment.slice(0, block) + code_segment.slice(end + this._block_comment_end.length),
				in_block_comment: false,
				result: { text: "", in_block_comment: false },
				complete: false,
			};
		}
		return {
			text: code_segment.slice(0, block),
			in_block_comment: true,
			result: { text: "", in_block_comment: true },
			complete: false,
		};
	}

	/** Responsibilities: _block comment output closure_. **/
	private close_block_comment(block_comment_contents: string): string {
		const end = block_comment_contents.indexOf(this._block_comment_end);
		if (end < 0) {
			return "";
		}
		return block_comment_contents.slice(end + this._block_comment_end.length);
	}

	/** Responsibilities: _ignored source range calculation_. **/
	private ignored_ranges(line: string, line_number: number, spans: readonly AstSourceSpan[]): SourceRange[] {
		const ranges: SourceRange[] = [];
		for (const span of spans) {
			if (line_number < span.start_line || line_number > span.end_line) {
				continue;
			}
			let start = 0;
			if (line_number === span.start_line) {
				start = span.start_column;
			}
			let end = line.length;
			if (line_number === span.end_line) {
				end = span.end_column;
			}
			ranges.push({ start, end });
		}
		return ranges;
	}

	/** Responsibilities: _line comment marker selection_. **/
	private line_comment_marker(python: boolean): string {
		if (python) {
			return this._python_line_comment;
		}
		return this._typescript_line_comment;
	}

	/** Responsibilities: _line comment marker location_. **/
	private line_comment_index(source_line: string, marker: string): number {
		const index = source_line.indexOf(marker);
		if (index < 0) {
			return source_line.length;
		}
		return index;
	}

	/** Responsibilities: _comment syntax marker validation_. **/
	private has_empty_marker(): boolean {
		if (this._block_comment_start.length === 0) {
			return true;
		}
		if (this._block_comment_end.length === 0) {
			return true;
		}
		if (this._python_line_comment.length === 0) {
			return true;
		}
		return this._typescript_line_comment.length === 0;
	}

	/** Responsibilities: _comment marker configuration_. **/
	public constructor(
		block_comment_start: string,
		block_comment_end: string,
		python_line_comment: string,
		typescript_line_comment: string,
	) {
		this._block_comment_start = block_comment_start;
		this._block_comment_end = block_comment_end;
		this._python_line_comment = python_line_comment;
		this._typescript_line_comment = typescript_line_comment;
		if (this.has_empty_marker()) {
			throw new Error("Comment syntax markers must not be empty.");
		}
	}

	/** Responsibilities: _non-empty code line count_. **/
	public count_code_lines(text: string, python: boolean, ...span_lists: (readonly AstSourceSpan[])[]): number {
		let ignored_spans: readonly AstSourceSpan[] = [];
		if (span_lists[0] !== undefined) {
			ignored_spans = span_lists[0];
		}
		let in_block_comment = false;
		let count = 0;
		for (const [index, raw_line] of text.split("\n").entries()) {
			const line = this.remove_ignored_spans(raw_line, index, ignored_spans);
			const code = this.scan_comment_segments({ line, in_block_comment, python });
			in_block_comment = code.in_block_comment;
			if (code.text.trim()) {
				count += 1;
			}
		}
		return count;
	}

	/** Responsibilities: _removal ignored source spans_. **/
	public remove_ignored_spans(line: string, line_number: number, spans: readonly AstSourceSpan[]): string {
		const ranges = this.ignored_ranges(line, line_number, spans);
		ranges.sort((left, right) => left.start - right.start);
		let result = "";
		let cursor = 0;
		for (const range of ranges) {
			result += line.slice(cursor, range.start);
			cursor = Math.max(cursor, range.end);
		}
		return result + line.slice(cursor);
	}

	/** Responsibilities: _source text comment scanning_. **/
	public scan_comment_segments(input: CommentLineScan): CommentScanResult {
		let text = input.line;
		let block_comment = input.in_block_comment;
		while (text) {
			const step = this.next_comment_segment(text, { in_block_comment: block_comment, python: input.python });
			if (step.complete) {
				return step.result;
			}
			({ text, in_block_comment: block_comment } = step);
		}
		return { text: "", in_block_comment: block_comment };
	}
}
