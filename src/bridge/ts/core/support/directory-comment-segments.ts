import type { AstSourceSpan } from 'src/types';
import type { CommentScanResult, SourceRange } from 'src/bridge/ts/core/types';
import type { CommentSegment } from 'src/bridge/ts/core/types';

/** Responsibilities: _source text identification scanning_. **/
export class DirectoryCommentSegments {
	private readonly block_comment_start = '/*';
	private readonly block_comment_end = '*/';
	private readonly python_line_comment = '#';
	private readonly typescript_line_comment = '//';

	/** Responsibilities: _aggregation comment span range_. **/
	private append_span_range(
		ranges: SourceRange[],
		line: string,
		line_number: number,
		span: AstSourceSpan
	): void {
if (line_number < span.start_line || line_number > span.end_line) {
			return;
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

	/** Responsibilities: _calculation comment documentation ranges_. **/
	private ignored_ranges(
		line: string,
		line_number: number,
		spans: readonly AstSourceSpan[]
	): SourceRange[] {
		const ranges: SourceRange[] = [];
		for (const span of spans) {
			this.append_span_range(ranges, line, line_number, span);
		}
		return ranges;
	}

	/** Responsibilities: _classification next comment code_. **/
	private next_comment_segment(text: string, inside: boolean, python: boolean): CommentSegment {
		if (inside) {
			return this.process_block_segment(text);
		}
		return this.process_code_segment(text, python);
	}

	/** Responsibilities: _consume block-comment segment reporting_. **/
	private process_block_segment(text: string): CommentSegment {
		const remainder = this.close_block_comment(text);
		if (remainder.length === 0) {
			return { text: '', in_block_comment: true, result: { text: '', in_block_comment: true }, complete: false };
		}
		return { text: remainder, in_block_comment: false, result: { text: '', in_block_comment: false }, complete: false };
	}

	/** Responsibilities: _consume line-comment segment output_. **/
	private process_line_segment(text: string, line_comment: number): CommentSegment {
		const code = text.slice(0, line_comment);
		const result: CommentScanResult = {
			text: code,
			in_block_comment: false,
		};
		return { text: '', in_block_comment: false, result, complete: true };
	}

	/** Responsibilities: _consume code segment up_. **/
	private process_code_segment(text: string, python: boolean): CommentSegment {
		const block = text.indexOf(this.block_comment_start);
		const line_comment = this.line_comment_index(text, python);
		if (block < 0 || line_comment < block) {
			return this.process_line_segment(text, line_comment);
		}
		const end = text.indexOf(this.block_comment_end, block + this.block_comment_start.length);
		if (end >= 0) {
			return {
				text: text.slice(0, block) + text.slice(end + this.block_comment_end.length),
				in_block_comment: false,
				result: { text: '', in_block_comment: false },
				complete: false,
			};
		}
		return {
			text: text.slice(0, block),
			in_block_comment: true,
			result: { text: '', in_block_comment: true },
			complete: false,
		};
	}

	/** Responsibilities: _block comment output closure_. **/
	private close_block_comment(text: string): string {
		const end = text.indexOf(this.block_comment_end);
		if (end < 0) {
			return '';
		}
		return text.slice(end + this.block_comment_end.length);
	}

	/** Responsibilities: _discovery next line-comment marker_. **/
	private line_comment_index(text: string, python: boolean): number {
		let marker = this.typescript_line_comment;
		if (python) {
			marker = this.python_line_comment;
		}
		const index = text.indexOf(marker);
		if (index < 0) {
			return text.length;
		}
		return index;
	}

	/** Responsibilities: _non-empty code line count_. **/
	public count_code_lines(
		text: string,
		python: boolean,
		...span_lists: (readonly AstSourceSpan[])[]
	): number {
		let ignored_spans: readonly AstSourceSpan[] = [];
		if (span_lists[0] !== undefined) {
			ignored_spans = span_lists[0];
		}
		let in_block_comment = false;
		let count = 0;
		for (const [index, raw_line] of text.split('\n').entries()) {
			const line = this.remove_ignored_spans(raw_line, index, ignored_spans);
			const code = this.scan_comment_segments(line, in_block_comment, python);
			in_block_comment = code.in_block_comment;
			if (code.text.trim()) {
				count += 1;
			}
		}
		return count;
	}

	/** Responsibilities: _removal ignored source spans_. **/
	public remove_ignored_spans(
		line: string,
		line_number: number,
		spans: readonly AstSourceSpan[]
	): string {
		const ranges = this.ignored_ranges(line, line_number, spans);
		ranges.sort((left, right) => left.start - right.start);
		let result = '';
		let cursor = 0;
		for (const range of ranges) {
			result += line.slice(cursor, range.start);
			cursor = Math.max(cursor, range.end);
		}
		return result + line.slice(cursor);
	}

	/** Responsibilities: _source text comment scanning_. **/
	public scan_comment_segments(
		line: string,
		in_block_comment: boolean,
		python: boolean
	): CommentScanResult {
		let text = line;
		let block_comment = in_block_comment;
		while (text) {
			const step = this.next_comment_segment(text, block_comment, python);
			if (step.complete) {
				return step.result;
			}
			({ text, in_block_comment: block_comment } = step);
		}
		return { text: '', in_block_comment: block_comment };
	}
}
