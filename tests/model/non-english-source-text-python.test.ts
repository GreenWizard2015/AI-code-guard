import { describe, expect, test } from "@jest/globals";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { NonEnglishSourceTextRules } from "src/rules/support/non_english_source_text_rules";
import { PythonSourceTextScanner } from "src/rules/support/python_source_text_scanner";

/** Responsibilities: _Cyrillic source text_, _CJK source text_, _Python type names_. **/
class PythonUnicodeSamples {
	/** Responsibilities: _Cyrillic greeting_. **/
	public greeting(): string {
		return String.fromCodePoint(0x041f, 0x0440, 0x0438, 0x0432, 0x0435, 0x0442);
	}

	/** Responsibilities: _CJK label_. **/
	public cjk_label(): string {
		return String.fromCodePoint(0x6f22, 0x5b57);
	}

	/** Responsibilities: _CJK greeting_. **/
	public cjk_greeting(): string {
		return String.fromCodePoint(0x4f60, 0x597d);
	}

	/** Responsibilities: _Cyrillic identifier_. **/
	public identifier(): string {
		return String.fromCodePoint(0x043f, 0x0440, 0x0438, 0x0432, 0x0435, 0x0442);
	}

	/** Responsibilities: _Cyrillic welcome_. **/
	public welcome(): string {
		return String.fromCodePoint(0x0414, 0x043e, 0x0431, 0x0440, 0x043e, 0x0020, 0x043f, 0x043e, 0x0436, 0x0430);
	}

	/** Responsibilities: _Cyrillic farewell_. **/
	public farewell(): string {
		return String.fromCodePoint(0x0415, 0x0449, 0x0451);
	}
}

describe("Python non-English source text rule", () => {
	test("reports comments and string literals, including CJK, in production", () => {
		const samples = new PythonUnicodeSamples();
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const violations = rules.source_violations(
			"sample.py",
			[
				`message = "${samples.greeting()} # not a comment"`,
				`label = "${samples.cjk_label()}"`,
				`# ${samples.greeting()}`,
			].join("\n"),
			true,
		);
		expect(violations.map((violation) => violation.line)).toEqual([1, 2, 3]);
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
		const violations = rules.source_violations("api.py", source, true);
		expect(violations.map((violation) => violation.line)).toEqual([5, 6]);
	});

	test("checks test comments but allows test string literals", () => {
		const samples = new PythonUnicodeSamples();
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const source = [`# ${samples.greeting()}`, `message = "${samples.greeting()}"`].join("\n");
		expect(rules.source_violations("tests/test_sample.py", source, true).map((item) => item.line)).toEqual([1]);
	});

	test("reports triple-quoted text and ignores non-English identifiers", () => {
		const samples = new PythonUnicodeSamples();
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const source = ['message = """English', samples.cjk_greeting(), '"""', `${samples.identifier()} = "hello"`].join(
			"\n",
		);
		const violations = rules.source_violations("sample.py", source, true);
		expect(violations.map((violation) => violation.line)).toEqual([2]);
	});

	test("checks f-string text but ignores interpolated identifiers", () => {
		const samples = new PythonUnicodeSamples();
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const source = [`message = f"${samples.welcome()}, {user_name}"`, `other = f"\${${samples.identifier()}}"`].join(
			"\n",
		);
		const violations = rules.source_violations("sample.py", source, true);
		expect(violations.map((violation) => violation.line)).toEqual([1]);
	});

	test("scans pre-split Python source lines", () => {
		const samples = new PythonUnicodeSamples();
		const scanner = new PythonSourceTextScanner();
		const occurrences = scanner.scan_lines([`# ${samples.greeting()}`, `message = "${samples.farewell()}"`]);
		expect(occurrences.map((occurrence) => occurrence.line)).toEqual([1, 2]);
	});

	test("ignores dynamically composed string values", () => {
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const violations = rules.source_violations(
			"sample.py",
			["message = runtime_message", "combined = prefix + suffix", 'formatted = f"{first}{second}"'].join("\n"),
			true,
		);
		expect(violations).toEqual([]);
	});
});
