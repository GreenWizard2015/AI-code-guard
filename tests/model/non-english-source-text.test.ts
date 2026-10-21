import { describe, expect, test } from "@jest/globals";
import { TextFileDiscovery } from "src/core/text_file_discovery";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { NonEnglishSourceTextRules } from "src/rules/support/non_english_source_text_rules";
import { PythonSourceTextScanner } from "src/rules/support/python_source_text_scanner";

/** Responsibilities: _Cyrillic sample text_, _CJK sample text_. **/
class UnicodeSourceSamples {
	/** Responsibilities: _Cyrillic greeting_. **/
	public greeting(): string {
		return String.fromCodePoint(0x041f, 0x0440, 0x0438, 0x0432, 0x0435, 0x0442);
	}

	/** Responsibilities: _Cyrillic welcome_. **/
	public welcome(): string {
		return String.fromCodePoint(
			0x0414,
			0x043e,
			0x0431,
			0x0440,
			0x043e,
			0x0020,
			0x043f,
			0x043e,
			0x0436,
			0x0430,
			0x043b,
			0x043e,
			0x0432,
			0x0430,
			0x0442,
			0x044c,
		);
	}

	/** Responsibilities: _Cyrillic identifier_. **/
	public identifier(): string {
		return String.fromCodePoint(0x043f, 0x0440, 0x0438, 0x0432, 0x0435, 0x0442);
	}

	/** Responsibilities: _Cyrillic farewell_. **/
	public farewell(): string {
		return String.fromCodePoint(0x0415, 0x0449, 0x0451);
	}

	/** Responsibilities: _CJK greeting_. **/
	public cjk_greeting(): string {
		return String.fromCodePoint(0x4f60, 0x597d);
	}

	/** Responsibilities: _CJK label_. **/
	public cjk_label(): string {
		return String.fromCodePoint(0x6f22, 0x5b57);
	}
}

describe("non-English source text rule", () => {
	test("reports non-English comments, strings, and CJK literals in TypeScript", () => {
		const samples = new UnicodeSourceSamples();
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const source = [
			`// ${samples.greeting()}`,
			'const message = "Welcome";',
			`const label = "${samples.cjk_greeting()}";`,
			"/*",
			` * ${samples.greeting()}`,
			" */",
		].join("\n");
		const violations = rules.source_violations("sample.ts", source, false);

		expect(violations.map((violation) => violation.line)).toEqual([1, 3, 4]);
	});

	test("reports non-English template text but ignores identifiers and interpolation code", () => {
		const samples = new UnicodeSourceSamples();
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const source = [
			`const message = \`${samples.cjk_greeting()} \${userName}\`;`,
			`const other = \`\${${samples.identifier()}}\`;`,
			'const café = "déjà vu";',
		].join("\n");
		const violations = rules.source_violations("sample.ts", source, false);

		expect(violations.map((violation) => violation.line)).toEqual([1]);
	});

	test("keeps TypeScript comment locations after repeated tokens", () => {
		const samples = new UnicodeSourceSamples();
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const violations = rules.source_violations(
			"sample.ts",
			[
				`// ${samples.greeting()}`,
				"const first = 1;",
				`/* ${samples.greeting()} */`,
				"const second = 2;",
				`// ${samples.farewell()}`,
			].join("\n"),
			false,
		);

		expect(violations.map((violation) => violation.line)).toEqual([1, 3, 5]);
	});

	test("reports Python comments and string literals, including CJK", () => {
		const samples = new UnicodeSourceSamples();
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

	test("reports Python triple-quoted text and ignores non-English identifiers", () => {
		const samples = new UnicodeSourceSamples();
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const source = ['message = """English', samples.cjk_greeting(), '"""', `${samples.identifier()} = "hello"`].join(
			"\n",
		);
		const violations = rules.source_violations("sample.py", source, true);

		expect(violations.map((violation) => violation.line)).toEqual([2]);
	});

	test("checks Python f-string text without treating interpolated identifiers as translations", () => {
		const samples = new UnicodeSourceSamples();
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const source = [`message = f"${samples.welcome()}, {user_name}"`, `other = f"\${${samples.identifier()}}"`].join(
			"\n",
		);
		const violations = rules.source_violations("sample.py", source, true);

		expect(violations.map((violation) => violation.line)).toEqual([1]);
	});

	test("scans pre-split Python source lines", () => {
		const samples = new UnicodeSourceSamples();
		const scanner = new PythonSourceTextScanner();
		const occurrences = scanner.scan_lines([`# ${samples.greeting()}`, `message = "${samples.farewell()}"`]);

		expect(occurrences.map((occurrence) => occurrence.line)).toEqual([1, 2]);
	});

	test("ignores dynamically composed strings in both languages", () => {
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const typescript = rules.source_violations(
			"sample.ts",
			[
				"const message = runtimeMessage;",
				"const combined = prefix + suffix;",
				"const formatted = `${first}${second}`;",
			].join("\n"),
			false,
		);
		const python = rules.source_violations(
			"sample.py",
			["message = runtime_message", "combined = prefix + suffix", 'formatted = f"{first}{second}"'].join("\n"),
			true,
		);

		expect({ typescript, python }).toEqual({ typescript: [], python: [] });
	});

	test("reports non-Latin prose in supported text files", () => {
		const samples = new UnicodeSourceSamples();
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const violations = rules.text_file_violations("README.md", `# Welcome\n\n${samples.cjk_greeting()}`);

		expect({
			count: violations.length,
			lines: violations.map((violation) => violation.line),
			files: violations.map((violation) => violation.file),
		}).toEqual({ count: 1, lines: [3], files: ["README.md"] });
	});

	test("does not lint fenced Markdown code examples as prose", () => {
		const samples = new UnicodeSourceSamples();
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const violations = rules.text_file_violations(
			"rule.md",
			["# Rule", "```ts", `// ${samples.cjk_greeting()}`, "```"].join("\n"),
		);

		expect(violations).toEqual([]);
	});

	test("reports one non-English violation per plain text file", () => {
		const samples = new UnicodeSourceSamples();
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const violations = rules.text_file_violations("notes.txt", `${samples.greeting()}\n\n${samples.farewell()}`);
		expect({
			count: violations.length,
			lines: violations.map((violation) => violation.line),
			files: violations.map((violation) => violation.file),
		}).toEqual({ count: 1, lines: [1], files: ["notes.txt"] });
	});

	test("discovers text files regardless of suffix case", () => {
		const samples = new UnicodeSourceSamples();
		const root = "/virtual/non-english-text-case";
		const source_io = new InMemoryProjectSourceIO(new Map([[`${root}/NOTES.TXT`, samples.cjk_greeting()]]));
		const discovery = new TextFileDiscovery(source_io);
		const violations = discovery.violations(root, new Set(), new Map());

		expect(violations).toHaveLength(1);
	});

	test("discovers plain text files for non-English text analysis", () => {
		const samples = new UnicodeSourceSamples();
		const root = "/virtual/non-english-text";
		const source_io = new InMemoryProjectSourceIO(
			new Map([[`${root}/notes.txt`, `${samples.greeting()}\n${samples.farewell()}`]]),
		);
		const discovery = new TextFileDiscovery(source_io);
		const violations = discovery.violations(root, new Set(), new Map());

		expect(violations).toHaveLength(1);
	});
});
