import { describe, expect, test } from "@jest/globals";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { NonEnglishSourceTextRules } from "src/rules/support/non_english_source_text_rules";
import { PythonSourceTextScanner } from "src/rules/support/python_source_text/python_source_text_scanner";
import { PythonUnicodeSamples } from "tests/model/python-unicode-samples";

describe("Python non-English source text rule", () => {
	test("returns no diagnostics for ASCII-only production source", () => {
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const violations = rules.source_violations({
			file: "sample.py",
			text: 'label = "plain ASCII"  # ordinary comment',
			language: "python",
			test_file: false,
			docstring_spans: [],
		});

		expect(violations).toHaveLength(0);
	});

	test("reports non-English comments but allows localized strings, including CJK", () => {
		const samples = new PythonUnicodeSamples();
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const violations = rules.source_violations({
			file: "sample.py",
			text: [
				`message = "${samples.greeting()} # not a comment"`,
				`label = "${samples.cjk_label()}"`,
				`# ${samples.greeting()}`,
			].join("\n"),
			language: "python",
			test_file: false,
			docstring_spans: [],
		});
		expect(violations.map((violation) => violation.line())).toEqual([3]);
	});

	test("allows localized __all__ names, annotations, defaults, and runtime strings", () => {
		const samples = new PythonUnicodeSamples();
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const source = [
			"__all__ = [",
			`    "${samples.greeting()}",`,
			"]",
			`def lookup(value: "${samples.identifier()}") -> "${samples.cjk_label()}":`,
			`def greet(message="${samples.greeting()}") -> "${samples.identifier()}":`,
			`    return "${samples.greeting()}"`,
		].join("\n");
		const violations = rules.source_violations({
			file: "api.py",
			text: source,
			language: "python",
			test_file: false,
			docstring_spans: [],
		});
		expect(violations).toEqual([]);
	});

	test("checks test comments and docstrings but allows ordinary test strings", () => {
		const samples = new PythonUnicodeSamples();
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const source = [
			`"""${samples.greeting()}"""`,
			`# ${samples.greeting()}`,
			`message = "${samples.greeting()}"`,
		].join("\n");
		expect(
			rules
				.source_violations({
					file: "tests/test_sample.py",
					text: source,
					language: "python",
					test_file: true,
					docstring_spans: [{ start_line: 0, start_column: 0, end_line: 0, end_column: 20 }],
				})
				.map((item) => item.line()),
		).toEqual([1, 2]);
	});

	test("reports non-English module, class, and function docstrings but allows ordinary strings", () => {
		const samples = new PythonUnicodeSamples();
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const inline_docstring_line = 'class LocalizedStringAfterDoc: """English docstring."""; value = "localized привет"';
		const inline_docstring_start = inline_docstring_line.indexOf('"""');
		const inline_docstring_end = inline_docstring_line.indexOf('"""', inline_docstring_start + 3) + 3;
		const source = [
			`"""${samples.greeting()}`,
			samples.cjk_greeting(),
			'"""',
			`message = "${samples.greeting()}"`,
			"class Service:",
			`    """${samples.greeting()}"""`,
			"    def lookup(self):",
			`        """${samples.cjk_greeting()}"""`,
			`        return "${samples.identifier()}"`,
			inline_docstring_line,
		].join("\n");
		const violations = rules.source_violations({
			file: "sample.py",
			text: source,
			language: "python",
			test_file: false,
			docstring_spans: [
				{ start_line: 0, start_column: 0, end_line: 2, end_column: 3 },
				{ start_line: 5, start_column: 4, end_line: 5, end_column: 40 },
				{ start_line: 7, start_column: 8, end_line: 7, end_column: 40 },
					{
						start_line: 9,
						start_column: inline_docstring_start,
						end_line: 9,
						end_column: inline_docstring_end,
					},
			],
		});
		expect(violations.map((violation) => violation.line())).toEqual([1, 2, 6, 8]);
	});

	test("allows localized f-string text and ignores interpolated identifiers", () => {
		const samples = new PythonUnicodeSamples();
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const source = [`message = f"${samples.welcome()}, {user_name}"`, `other = f"\${${samples.identifier()}}"`].join(
			"\n",
		);
		const violations = rules.source_violations({
			file: "sample.py",
			text: source,
			language: "python",
			test_file: false,
			docstring_spans: [],
		});
		expect(violations).toEqual([]);
	});

	test("scans pre-split Python source lines", () => {
		const samples = new PythonUnicodeSamples();
		const scanner = new PythonSourceTextScanner();
		const occurrences = scanner.scan_lines([`# ${samples.greeting()}`, `message = "${samples.farewell()}"`]);
		expect(occurrences.map((occurrence) => occurrence.line)).toEqual([1, 2]);
	});

	test("ignores dynamically composed string values", () => {
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const violations = rules.source_violations({
			file: "sample.py",
			text: ["message = runtime_message", "combined = prefix + suffix", 'formatted = f"{first}{second}"'].join("\n"),
			language: "python",
			test_file: false,
			docstring_spans: [],
		});
		expect(violations).toEqual([]);
	});
});
