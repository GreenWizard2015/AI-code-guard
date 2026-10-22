import { describe, expect, test } from "@jest/globals";
import { TextFileDiscovery } from "src/core/text_file_discovery";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { NonEnglishSourceTextRules } from "src/rules/support/non_english_source_text_rules";

describe("Markdown non-English source text rule", () => {
	test("reports non-Latin prose", () => {
		const cjk_greeting = String.fromCodePoint(0x4f60, 0x597d);
		const rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		const violations = rules.text_file_violations("README.md", `# Welcome\n\n${cjk_greeting}`);
		expect(violations.map((item) => [item.file, item.line])).toEqual([["README.md", 3]]);
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
		const markdown_files = discovery.files_unfiltered(root, new Set());
		const violations = discovery.violations_for_files(markdown_files, root, new Map());
		expect({ files: markdown_files.length, violations: violations.length }).toEqual({ files: 2, violations: 2 });
	});
});
