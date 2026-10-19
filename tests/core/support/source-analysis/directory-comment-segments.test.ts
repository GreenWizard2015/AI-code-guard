import { DirectoryCommentSegments } from "src/core/support/source-analysis/directory_comment_segments";
import { describe, expect, test } from "@jest/globals";

describe("directory comment segments", () => {
	test("keeps docstrings in raw file counts unless explicitly ignored", () => {
		const directory_comment_segments = new DirectoryCommentSegments();
		const source = ['"""module documentation"""', "", "value = 1"].join("\n");

		expect(directory_comment_segments.count_code_lines(source, true)).toBe(2);
		expect(
			directory_comment_segments.count_code_lines(source, true, [
				{ start_line: 0, start_column: 0, end_line: 0, end_column: 27 },
			]),
		).toBe(1);
	});

	test("keeps code after a same-line docstring in raw file counts", () => {
		const directory_comment_segments = new DirectoryCommentSegments();
		const source = '"""doc"""; value = 1';

		expect(
			directory_comment_segments.count_code_lines(source, true, [
				{ start_line: 0, start_column: 0, end_line: 0, end_column: 9 },
			]),
		).toBe(1);
	});
});
