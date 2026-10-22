import { join, relative, sep } from "node:path";
import { DocumentationLanguage, ExampleKind } from "#documentation_validation/types";
import { MarkdownLoopExpander } from "#documentation_validation/markdown_loop_expander";
import { PYTHON_LANGUAGE, RULE_DOCUMENT_DIRECTORY, TYPESCRIPT_LANGUAGE } from "src/constants";
import { RuleDocumentationPaths } from "#documentation_validation/rule_documentation_paths";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";
import type {
	DocumentationExample,
	DocumentationExampleSourceFile,
	RuleDocumentationDocument,
	RuleDocumentationInventory,
} from "#documentation_validation/types";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type { SystemFailureClassificationContract } from "src/analysis_protocols";

/** Responsibilities: _rule document collection_, _example indexing_. **/
export class RuleDocumentationCatalog {
	private readonly root: string;
	private readonly paths: RuleDocumentationPaths;
	private readonly loop_expander: MarkdownLoopExpander;
	private readonly boundary_failures: SystemFailureClassificationContract;
	private readonly source_io: ProjectSourceIOContract;

	/** Responsibilities: _Markdown section extraction_. **/
	private section_text(document: string, kind: ExampleKind): string {
		const section_pattern = /^##\s+(.+?)\s*#*\s*\r?\n([\s\S]*?)(?=^##\s+|(?![\s\S]))/gmu;
		for (const match of document.matchAll(section_pattern)) {
			if (match[1]?.trim() !== kind) {
				continue;
			}
			const section = match[2];
			if (section !== undefined) {
				return section;
			}
		}
		return "";
	}

	/** Responsibilities: _example language classification_. **/
	private language_for_fence(label: string): DocumentationLanguage {
		if (label.startsWith("t")) {
			return DocumentationLanguage.TYPESCRIPT;
		}
		return DocumentationLanguage.PYTHON;
	}

	/** Responsibilities: _source file marker selection_. **/
	private source_file_marker(language: DocumentationLanguage): string {
		if (language === DocumentationLanguage.PYTHON) {
			return "# File: ";
		}
		return "// File: ";
	}

	/** Responsibilities: _source file record completion_. **/
	private append_source_file(files: DocumentationExampleSourceFile[], path: string, lines: readonly string[]): void {
		if (path.length > 0) {
			files.push({ path, text: lines.join("\n") });
		}
	}

	/** Responsibilities: _multi-file source example extraction_. **/
	private source_files(text: string, language: DocumentationLanguage): readonly DocumentationExampleSourceFile[] {
		const files: DocumentationExampleSourceFile[] = [];
		let path = "";
		let lines: string[] = [];
		const marker = this.source_file_marker(language);
		for (const line of text.split(/\r?\n/u)) {
			if (!line.startsWith(marker)) {
				lines.push(line);
				continue;
			}
			this.append_source_file(files, path, lines);
			path = line.slice(marker.length).trim();
			lines = [];
		}
		this.append_source_file(files, path, lines);
		return files;
	}

	/** Responsibilities: _language example extraction_. **/
	private section_examples(rule_id: string, document: string, kind: ExampleKind): DocumentationExample[] {
		const section = this.section_text(document, kind);
		const fence = /^```(ts|typescript|py|python)\s*\r?\n([\s\S]*?)^```\s*$/gmu;
		const language_indices = new Map<DocumentationLanguage, number>();
		const matches = [...section.matchAll(fence)];
		return matches.flatMap((match) => this.indexed_example(rule_id, kind, match, language_indices));
	}

	/** Responsibilities: _example source indexing_. **/
	private indexed_example(
		rule_id: string,
		kind: ExampleKind,
		match: RegExpMatchArray,
		language_indices: Map<DocumentationLanguage, number>,
	): DocumentationExample[] {
		const label = match[1];
		if (label === undefined) {
			return [];
		}
		const text = match[2];
		if (text === undefined) {
			return [];
		}
		const language = this.language_for_fence(label);
		const source_files = this.source_files(text, language);
		let index = language_indices.get(language);
		if (index === undefined) {
			index = 0;
		}
		language_indices.set(language, index + 1);
		return [{ rule_id, language, kind, index, text, source_files }];
	}

	/** Responsibilities: _rule document folder language_. **/
	private document_languages(file_path: string): readonly DocumentationLanguage[] {
		const documentation_root = join(this.root, RULE_DOCUMENT_DIRECTORY);
		const document_relative_path = relative(documentation_root, join(this.root, file_path));
		const [folder] = document_relative_path.split(sep);
		if (folder === TYPESCRIPT_LANGUAGE) {
			return [DocumentationLanguage.TYPESCRIPT];
		}
		if (folder === PYTHON_LANGUAGE) {
			return [DocumentationLanguage.PYTHON];
		}
		return [];
	}

	/** Responsibilities: _rule document loading_. **/
	private describe_path(rule_id: string, file_path: string): RuleDocumentationDocument {
		const source = this.source_io.source_text(join(this.root, file_path));
		const text = this.loop_expander.expand(source);
		const languages = this.document_languages(file_path);
		const examples = new Map<ExampleKind, readonly DocumentationExample[]>();
		for (const kind of [ExampleKind.BAD, ExampleKind.GOOD]) {
			examples.set(kind, this.section_examples(rule_id, text, kind));
		}
		return { rule_id, file_path, text, languages, examples };
	}

	/** Responsibilities: _catalog dependency ownership_. **/
	public constructor(root: string, rule_ids: readonly string[], source_io: ProjectSourceIOContract) {
		this.root = root;
		this.source_io = source_io;
		this.paths = new RuleDocumentationPaths(root, rule_ids, source_io);
		this.boundary_failures = new BoundaryFailureClassifier();
		this.loop_expander = new MarkdownLoopExpander(this.boundary_failures);
	}

	/** Responsibilities: _catalog rule documentation access_. **/
	public describe_rule(rule_id: string): RuleDocumentationDocument {
		return this.describe_path(rule_id, this.paths.primary_path(rule_id));
	}

	/** Responsibilities: _complete rule inventory_. **/
	public collect(requested_rules: readonly string[]): RuleDocumentationInventory {
		const inventory = this.paths.scan();
		let selected_documents = inventory.present_documents;
		if (requested_rules.length > 0) {
			selected_documents = selected_documents.filter((document) => requested_rules.includes(document.rule_id));
		}
		const documents = selected_documents.map(({ rule_id, file_path }) => {
			if (file_path === this.paths.primary_path(rule_id)) {
				return this.describe_rule(rule_id);
			}
			return this.describe_path(rule_id, file_path);
		});
		return {
			documents,
			unknown_rules: requested_rules.filter((rule_id) => !inventory.registered_rule_ids.has(rule_id)),
			invalid_entries: inventory.invalid_entries,
			missing_documents: inventory.missing_documents,
		};
	}
}
