import { describe, expect, test } from "@jest/globals";
import { TextFileDiscovery } from "src/core/text_file_discovery";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { CyrillicTextRules } from "src/rules/support/cyrillic_text_rules";

describe("Cyrillic comment and text file rules", () => {
	test("reports Cyrillic in TypeScript comments but not strings", () => {
		const rules = new CyrillicTextRules(new DiagnosticRule("cyrillic-comment"));
		const violations = rules.source_violations(
			"sample.ts",
			["// Привет", 'const message = "Привет";', "/*", " * Мир", " */"].join("\n"),
			false,
		);
		expect(violations.map((violation) => violation.line)).toEqual([1, 3]);
	});

	test("keeps comment locations after repeated TypeScript tokens", () => {
		const rules = new CyrillicTextRules(new DiagnosticRule("cyrillic-comment"));
		const violations = rules.source_violations(
			"sample.ts",
			["// Привет", "const first = 1;", "/* Мир */", "const second = 2;", "// Ещё"].join("\n"),
			false,
		);

		expect(violations.map((violation) => violation.line)).toEqual([1, 3, 5]);
	});

	test("reports Cyrillic in standalone TypeScript template comments", () => {
		const rules = new CyrillicTextRules(new DiagnosticRule("cyrillic-comment"));
		const violations = rules.source_violations(
			"sample.ts",
			["`English comment", "Привет`;", "const message = `Русский value`;"].join("\n"),
			false,
		);
		expect(violations.map((violation) => violation.line)).toEqual([1]);
	});

	test("reports Python comments but not string literals", () => {
		const rules = new CyrillicTextRules(new DiagnosticRule("cyrillic-comment"));
		const violations = rules.source_violations(
			"sample.py",
			['message = "Привет # не комментарий"', "# Мир"].join("\n"),
			true,
		);
		expect(violations.map((violation) => violation.line)).toEqual([2]);
	});

	test("reports one Cyrillic violation per text file", () => {
		const rules = new CyrillicTextRules(new DiagnosticRule("cyrillic-comment"));
		const violations = rules.text_file_violations("README.md", "# Привет\n\nМир");

		expect({
			count: violations.length,
			lines: violations.map((violation) => violation.line),
			files: violations.map((violation) => violation.file),
		}).toEqual({ count: 1, lines: [1], files: ["README.md"] });
	});

	test("does not lint fenced Markdown code examples as prose", () => {
		const rules = new CyrillicTextRules(new DiagnosticRule("cyrillic-comment"));
		const violations = rules.text_file_violations("rule.md", ["# Rule", "```ts", "// Привет", "```"].join("\n"));

		expect(violations).toEqual([]);
	});

	test("reports one Cyrillic violation per plain text file", () => {
		const rules = new CyrillicTextRules(new DiagnosticRule("cyrillic-comment"));
		const violations = rules.text_file_violations("notes.txt", "Привет\n\nМир");
		expect({
			count: violations.length,
			lines: violations.map((violation) => violation.line),
			files: violations.map((violation) => violation.file),
		}).toEqual({ count: 1, lines: [1], files: ["notes.txt"] });
	});

	test("discovers text files regardless of suffix case", () => {
		const root = "/virtual/cyrillic-text-case";
		const source_io = new InMemoryProjectSourceIO(new Map([[`${root}/NOTES.TXT`, "Привет"]]));
		const text_file_discovery = new TextFileDiscovery(source_io);
		const violations = text_file_discovery.violations(root, new Set(), new Map());

		expect(violations).toHaveLength(1);
	});

	test("discovers plain text files for Cyrillic analysis", () => {
		const root = "/virtual/cyrillic-text";
		const source_io = new InMemoryProjectSourceIO(new Map([[`${root}/notes.txt`, "Привет\nМир"]]));
		const text_file_discovery = new TextFileDiscovery(source_io);
		const violations = text_file_discovery.violations(root, new Set(), new Map());

		expect(violations).toHaveLength(1);
	});

	test("ignores Cyrillic inside a Python triple-quoted string", () => {
		const rules = new CyrillicTextRules(new DiagnosticRule("cyrillic-comment"));
		const violations = rules.source_violations(
			"sample.py",
			['message = """Привет # не комментарий', 'ещё текст"""'].join("\n"),
			true,
		);
		expect(violations).toEqual([]);
	});

	test("reports Cyrillic in standalone Python triple-quoted comments", () => {
		const rules = new CyrillicTextRules(new DiagnosticRule("cyrillic-comment"));
		const violations = rules.source_violations(
			"sample.py",
			['"""English comment', "Привет", '"""', 'message = "Русский value"'].join("\n"),
			true,
		);
		expect(violations.map((violation) => violation.line)).toEqual([2]);
	});
});
