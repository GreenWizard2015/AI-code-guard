import { describe, expect, test } from "@jest/globals";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { NonEnglishSourceTextRules } from "src/rules/support/non_english_source_text_rules";
import { PythonSourceTextScanner } from "src/rules/support/python_source_text_scanner";
import { PythonUnicodeSamples } from "tests/model/python-unicode-samples";

describe("Python non-English source text rule", () => {
	test("returns no diagnostics for ASCII-only production source", () => {
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const violations = rules.source_violations({
			file: "sample.py",
			text: 'label = "plain ASCII"  # ordinary comment',
			language: "python",
			test_file: false,
		});

		expect(violations).toHaveLength(0);
	});

	test("reports comments and string literals, including CJK, in production", () => {
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
		});
		expect(violations.map((violation) => violation.line())).toEqual([1, 2, 3]);
	});

	test("ignores __all__ names and quoted type annotations only", () => {
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
		const violations = rules.source_violations({ file: "api.py", text: source, language: "python", test_file: false });
		expect(violations.map((violation) => violation.line())).toEqual([5, 6]);
	});

	test("checks test comments but allows test string literals", () => {
		const samples = new PythonUnicodeSamples();
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const source = [`# ${samples.greeting()}`, `message = "${samples.greeting()}"`].join("\n");
		expect(
			rules
				.source_violations({
					file: "tests/test_sample.py",
					text: source,
					language: "python",
					test_file: true,
				})
				.map((item) => item.line()),
		).toEqual([1]);
	});

	test("reports triple-quoted text and ignores non-English identifiers", () => {
		const samples = new PythonUnicodeSamples();
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const source = ['message = """English', samples.cjk_greeting(), '"""', `${samples.identifier()} = "hello"`].join(
			"\n",
		);
		const violations = rules.source_violations({
			file: "sample.py",
			text: source,
			language: "python",
			test_file: false,
		});
		expect(violations.map((violation) => violation.line())).toEqual([2]);
	});

	test("checks f-string text but ignores interpolated identifiers", () => {
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
		});
		expect(violations.map((violation) => violation.line())).toEqual([1]);
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
		});
		expect(violations).toEqual([]);
	});
});
