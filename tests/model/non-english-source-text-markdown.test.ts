import { describe, expect, test } from "@jest/globals";
import { TextFileDiscovery } from "src/core/discovery/text_file_discovery";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { NonEnglishSourceTextRules } from "src/rules/support/non_english_source_text_rules";

describe("Markdown non-English source text rule", () => {
	test("reports non-Latin prose", () => {
		const cjk_greeting = String.fromCodePoint(0x4f60, 0x597d);
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const violations = rules.text_file_violations("README.md", `# Welcome\n\n${cjk_greeting}`);
		expect(violations.map((item) => [item.file(), item.line()])).toEqual([["README.md", 3]]);
	});

	test("ignores fenced code while checking prose", () => {
		const cjk_greeting = String.fromCodePoint(0x4f60, 0x597d);
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const violations = rules.text_file_violations(
			"guide.md",
			["# Welcome", "```ts", `const label = "${cjk_greeting}";`, "```"].join("\n"),
		);
		expect(violations).toEqual([]);
	});

	test("ignores non-English text in inline code but still checks surrounding prose", () => {
		const cyrillic_word = String.fromCodePoint(0x43f, 0x440, 0x435, 0x43c, 0x44c, 0x435, 0x440);
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const violations = rules.text_file_violations(
			"notes.md",
			`The \`${cyrillic_word}\` token appears in this sentence.\n${cyrillic_word} outside code is still prose.`,
		);
		expect(violations.map((item) => item.line())).toEqual([2]);
	});

	test("matches inline-code delimiter lengths and masks spans across lines", () => {
		const cyrillic_word = String.fromCodePoint(0x43f, 0x440, 0x435, 0x43c, 0x44c, 0x435, 0x440);
		const tick = String.fromCharCode(0x60);
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const violations = rules.text_file_violations(
			"notes.md",
			[`Double ticks: ${tick}${tick}code ${cyrillic_word} with ${tick} tick`, `${tick}${tick} and prose`].join("\n"),
		);
		expect(violations).toEqual([]);
	});

	test("accepts prose whose non-English language is declared in front matter", () => {
		const cyrillic_heading = String.fromCodePoint(0x41f, 0x440, 0x438, 0x43c, 0x435, 0x440);
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const violations = rules.text_file_violations("ideas.md", `---\nlanguage: ru\n---\n\n# ${cyrillic_heading}`);
		expect(violations).toEqual([]);
	});

	test("continues checking prose when the declared language is English", () => {
		const cyrillic_heading = String.fromCodePoint(0x41f, 0x440, 0x438, 0x43c, 0x435, 0x440);
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const violations = rules.text_file_violations("guide.md", `---\nlanguage: en\n---\n\n# ${cyrillic_heading}`);
		expect(violations.map((item) => item.line())).toEqual([5]);
	});

	test("discovers Markdown files across configured project paths", () => {
		const cjk_greeting = String.fromCodePoint(0x4f60, 0x597d);
		const root = "/virtual/non-english-markdown";
		const source_io = new InMemoryProjectSourceIO(
			new Map([
				[`${root}/README.md`, `# ${cjk_greeting}`],
				[`${root}/docs/guide.MD`, `# ${cjk_greeting}`],
			]),
		);
		const discovery = new TextFileDiscovery(source_io);
		const project = discovery.for_project(root, new Set());
		const markdown_files = project.files_unfiltered();
		const violations = project.violations_for_files(markdown_files, new Map());
		expect({ files: markdown_files.length, violations: violations.length }).toEqual({ files: 2, violations: 2 });
	});

	test("keeps ignored directories scoped to each project context", () => {
		const root_a = "/virtual/text-project-a";
		const root_b = "/virtual/text-project-b";
		const source_io = new InMemoryProjectSourceIO(
			new Map([
				[`${root_a}/docs/generated/nested/guide.md`, "# Guide"],
				[`${root_b}/docs/generated/nested/guide.md`, "# Guide"],
			]),
		);
		const discovery = new TextFileDiscovery(source_io);
		const project_a = discovery.for_project(root_a, new Set([`${root_a}/docs/generated`]));
		const project_b = discovery.for_project(root_b, new Set());

		expect({ files_a: project_a.files_unfiltered().length, files_b: project_b.files_unfiltered().length }).toEqual({
			files_a: 0,
			files_b: 1,
		});
	});
});
