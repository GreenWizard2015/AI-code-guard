import { describe, expect, test } from "@jest/globals";
import { PythonSourceTextScanner } from "src/rules/support/python_source_text_scanner";

describe("Python source text scanner", () => {
	test("keeps braces inside nested f-string expressions out of trailing literal text", () => {
		const scanner = new PythonSourceTextScanner();
		const occurrences = scanner.scan(`message = f"{ {'key': '}'} } trailing"`);

		expect(occurrences.some((occurrence) => occurrence.kind === "string" && occurrence.text.includes("trailing"))).toBe(
			true,
		);
	});

	test("starts a fresh expression state for the next source scan", () => {
		const scanner = new PythonSourceTextScanner();
		scanner.scan(`unfinished = f"{call(`);
		const occurrences = scanner.scan('message = f"{items[0]} tail"');

		expect(occurrences.some((occurrence) => occurrence.kind === "string" && occurrence.text.includes("tail"))).toBe(
			true,
		);
	});

	test("preserves multiline quote state and separates comments from literal text", () => {
		const scanner = new PythonSourceTextScanner();
		const occurrences = scanner.scan('value = """first\nsecond # inside\nthird""" # outside');

		expect(occurrences.map(({ line, text, kind }) => ({ line, text, kind }))).toEqual([
			{ line: 1, text: "first", kind: "string" },
			{ line: 2, text: "second # inside", kind: "string" },
			{ line: 3, text: "# outside", kind: "comment" },
			{ line: 3, text: "third", kind: "string" },
		]);
	});

	test("resets quote and expression state between line-list scans", () => {
		const scanner = new PythonSourceTextScanner();
		scanner.scan_lines(['value = """unfinished']);
		const occurrences = scanner.scan_lines(['message = "finished" # trailing']);

		expect(occurrences.map(({ line, text, kind }) => ({ line, text, kind }))).toEqual([
			{ line: 1, text: "# trailing", kind: "comment" },
			{ line: 1, text: "finished", kind: "string" },
		]);
	});

	test("tracks multiline callable annotation lines", () => {
		const scanner = new PythonSourceTextScanner();
		const lines = scanner.declaration_lines('def build(\n    source: "Source",\n) -> "Result":\n    return source');

		expect([...lines.annotation]).toEqual([1, 2, 3]);
	});

	test("tracks every line in a multiline export list", () => {
		const scanner = new PythonSourceTextScanner();
		const lines = scanner.declaration_lines('__all__ = [\n    "Service",\n]\nlabel = "ordinary text"');

		expect([...lines.exports]).toEqual([1, 2, 3]);
	});
});
