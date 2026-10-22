import { describe, expect, test } from "@jest/globals";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { NonEnglishSourceTextRules } from "src/rules/support/non_english_source_text_rules";
import { TypeScriptSourceTextScanner } from "src/rules/support/type_script_source_text_scanner";

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
	test("reports non-English comments and literals in production TypeScript", () => {
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

	test("checks test comments but allows test string literals", () => {
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const samples = new UnicodeSourceSamples();
		const source = [`// ${samples.greeting()}`, `const message = "${samples.greeting()}";`].join("\n");

		expect(rules.source_violations("tests/fixture.test.ts", source, false).map((item) => item.line)).toEqual([1]);
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

	test("records TypeScript columns for comments and string literals", () => {
		const scanner = new TypeScriptSourceTextScanner();
		const occurrences = scanner.scan('  const label = "message"; // note\n');

		expect(occurrences.map((occurrence) => [occurrence.kind, occurrence.column])).toEqual([
			["comment", 27],
			["string", 16],
		]);
	});
});
