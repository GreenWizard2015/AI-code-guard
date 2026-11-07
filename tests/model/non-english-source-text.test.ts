import { describe, expect, test } from "@jest/globals";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { NonEnglishSourceTextRules } from "src/rules/support/non_english_source_text_rules";
import { TypeScriptSourceTextScanner } from "src/rules/support/type_script_source_text_scanner";
import { UnicodeSourceSamples } from "tests/model/unicode-source-samples";

describe("non-English source text rule", () => {
	test("returns no diagnostics for ASCII-only production source", () => {
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const violations = rules.source_violations({
			file: "sample.ts",
			text: 'export const label = "plain ASCII"; // ordinary comment',
			language: "typescript",
			test_file: false,
		});

		expect(violations).toHaveLength(0);
	});

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
		const violations = rules.source_violations({
			file: "sample.ts",
			text: source,
			language: "typescript",
			test_file: false,
		});

		expect(violations.map((violation) => violation.line())).toEqual([1, 3, 4]);
	});

	test("checks test comments but allows test string literals", () => {
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const samples = new UnicodeSourceSamples();
		const source = [`// ${samples.greeting()}`, `const message = "${samples.greeting()}";`].join("\n");

		expect(
			rules
				.source_violations({
					file: "tests/fixture.test.ts",
					text: source,
					language: "typescript",
					test_file: true,
				})
				.map((item) => item.line()),
		).toEqual([1]);
	});

	test("reports non-English template text but ignores identifiers and interpolation code", () => {
		const samples = new UnicodeSourceSamples();
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const source = [
			`const message = \`${samples.cjk_greeting()} \${userName}\`;`,
			`const other = \`\${${samples.identifier()}}\`;`,
			'const café = "déjà vu";',
		].join("\n");
		const violations = rules.source_violations({
			file: "sample.ts",
			text: source,
			language: "typescript",
			test_file: false,
		});

		expect(violations.map((violation) => violation.line())).toEqual([1]);
	});

	test("keeps TypeScript comment locations after repeated tokens", () => {
		const samples = new UnicodeSourceSamples();
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const violations = rules.source_violations({
			file: "sample.ts",
			text: [
				`// ${samples.greeting()}`,
				"const first = 1;",
				`/* ${samples.greeting()} */`,
				"const second = 2;",
				`// ${samples.farewell()}`,
			].join("\n"),
			language: "typescript",
			test_file: false,
		});

		expect(violations.map((violation) => violation.line())).toEqual([1, 3, 5]);
	});

	test("records TypeScript columns for comments and string literals", () => {
		const scanner = new TypeScriptSourceTextScanner('  const label = "message"; // note\n');
		const occurrences = scanner.scan();

		expect(occurrences.map((occurrence) => [occurrence.kind, occurrence.column])).toEqual([
			["string", 16],
			["comment", 27],
		]);
	});

	test("keeps token line numbers across CRLF and multiline comments", () => {
		const source = 'const first = "a";\r\n/* first line\nsecond line */\r\nconst last = "b";';
		const scanner = new TypeScriptSourceTextScanner(source);
		const occurrences = scanner.scan();

		expect(occurrences.map((occurrence) => [occurrence.kind, occurrence.line])).toEqual([
			["string", 1],
			["comment", 2],
			["string", 4],
		]);
	});
});
