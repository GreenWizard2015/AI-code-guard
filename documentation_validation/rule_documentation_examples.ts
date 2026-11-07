import { DocumentationLanguage, ExampleKind } from "documentation_validation/types";
import type {
	DocumentationExampleSourceFile,
	DocumentationExampleSourceFiles,
	RuleDocumentationExampleData,
} from "documentation_validation/types";

/** Responsibilities: _Markdown example indexing state_, _documented example groups_. **/
export class RuleDocumentationExamples {
	private readonly _markdown: string;
	private readonly _examples: Map<ExampleKind, readonly RuleDocumentationExampleData[]>;

	/** Responsibilities: _example section indexing_. **/
	private example_sections(markdown: string): ReadonlyMap<ExampleKind, string> {
		const section_pattern = /^##\s+(.+?)\s*#*\s*\r?\n([\s\S]*?)(?=^##\s+|(?![\s\S]))/gmu;
		const sections = new Map<ExampleKind, string>();
		for (const match of markdown.matchAll(section_pattern)) {
			const heading = match[1];
			if (heading === undefined) {
				continue;
			}
			const section_kind = heading.trim();
			if (section_kind !== ExampleKind.BAD && section_kind !== ExampleKind.GOOD) {
				continue;
			}
			if (!sections.has(section_kind)) {
				sections.set(section_kind, match[2] ?? "");
			}
		}
		return sections;
	}

	/** Responsibilities: _example source file emission_. **/
	private append_example_file(
		files: DocumentationExampleSourceFile[],
		lines: readonly string[],
		start: number,
		end: number,
		marker: string,
	): void {
		const marker_line = lines[start];
		if (marker_line === undefined) {
			return;
		}
		const path = marker_line.slice(marker.length).trim();
		if (path.length > 0) {
			files.push({ path, text: lines.slice(start + 1, end).join("\n") });
		}
	}

	/** Responsibilities: _example marker range extraction_. **/
	private example_file_ranges(lines: readonly string[], marker: string): { start: number; end: number }[] {
		const ranges: { start: number; end: number }[] = [];
		let start = -1;
		for (const [index, line] of lines.entries()) {
			if (!line.startsWith(marker)) {
				continue;
			}
			if (start >= 0) {
				ranges.push({ start, end: index });
			}
			start = index;
		}
		if (start >= 0) {
			ranges.push({ start, end: lines.length });
		}
		return ranges;
	}

	/** Responsibilities: _Markdown example source assembly_. **/
	private example_source_files(example_data: RuleDocumentationExampleData): DocumentationExampleSourceFiles {
		const marker = example_data.language === DocumentationLanguage.PYTHON ? "# File: " : "// File: ";
		const lines = example_data.text.split(/\r?\n/u);
		const files: DocumentationExampleSourceFile[] = [];
		for (const range of this.example_file_ranges(lines, marker)) {
			this.append_example_file(files, lines, range.start, range.end, marker);
		}
		return files;
	}

	/** Responsibilities: _fenced example language_. **/
	private example_language(label: string): DocumentationLanguage {
		if (label.startsWith("t")) {
			return DocumentationLanguage.TYPESCRIPT;
		}
		return DocumentationLanguage.PYTHON;
	}

	/** Responsibilities: _language example index_. **/
	private next_example_index(
		language_indices: Map<DocumentationLanguage, number>,
		language: DocumentationLanguage,
	): number {
		const index = language_indices.get(language) ?? 0;
		language_indices.set(language, index + 1);
		return index;
	}

	/** Responsibilities: _documented example construction_. **/
	private documented_example(
		match: RegExpMatchArray,
		kind: ExampleKind,
		language_indices: Map<DocumentationLanguage, number>,
	): RuleDocumentationExampleData {
		const label = match[1];
		const text = match[2];
		if (label === undefined || text === undefined) {
			throw new Error(`Malformed ${kind} Markdown example fence: expected language and source captures.`);
		}
		const language = this.example_language(label);
		const index = this.next_example_index(language_indices, language);
		const example_data: RuleDocumentationExampleData = { kind, language, index, text, source_files: [] };
		return { ...example_data, source_files: this.example_source_files(example_data) };
	}

	/** Responsibilities: _language-specific example indexing_. **/
	private documented_examples(section: string, kind: ExampleKind): RuleDocumentationExampleData[] {
		const fence = /^```(ts|typescript|py|python)\s*\r?\n([\s\S]*?)^```\s*$/gmu;
		const language_indices = new Map<DocumentationLanguage, number>();
		const examples: RuleDocumentationExampleData[] = [];
		for (const match of section.matchAll(fence)) {
			examples.push(this.documented_example(match, kind, language_indices));
		}
		return examples;
	}

	/** Responsibilities: _example group indexing_. **/
	private index_examples(): void {
		if (this._examples.size > 0) {
			return;
		}
		const sections = this.example_sections(this._markdown);
		const bad_examples = this.documented_examples(sections.get(ExampleKind.BAD) ?? "", ExampleKind.BAD);
		const good_examples = this.documented_examples(sections.get(ExampleKind.GOOD) ?? "", ExampleKind.GOOD);
		this._examples.set(ExampleKind.BAD, bad_examples);
		this._examples.set(ExampleKind.GOOD, good_examples);
	}

	/** Responsibilities: _Markdown example state_. **/
	public constructor(markdown: string) {
		this._markdown = markdown;
		this._examples = new Map();
	}

	/** Responsibilities: _Bad documented example access_. **/
	public bad_examples(): readonly RuleDocumentationExampleData[] {
		this.index_examples();
		const examples = this._examples.get(ExampleKind.BAD);
		if (examples === undefined) {
			throw new Error("Bad Markdown example group was not indexed.");
		}
		return examples;
	}

	/** Responsibilities: _Good documented example access_. **/
	public good_examples(): readonly RuleDocumentationExampleData[] {
		this.index_examples();
		const examples = this._examples.get(ExampleKind.GOOD);
		if (examples === undefined) {
			throw new Error("Good Markdown example group was not indexed.");
		}
		return examples;
	}
}
