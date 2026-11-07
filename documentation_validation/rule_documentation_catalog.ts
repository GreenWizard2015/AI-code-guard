import { join, relative, sep } from "node:path";
import { MarkdownLoopExpander } from "documentation_validation/markdown_loop_expander";
import { RuleDocumentationExamples } from "documentation_validation/rule_documentation_examples";
import { RuleDocumentationPaths } from "documentation_validation/rule_documentation_paths";
import { DocumentationLanguage, ExampleKind } from "documentation_validation/types";
import type { DocumentationExample, RuleDocumentationExampleData } from "documentation_validation/types";
import type {
	RuleDocumentPath,
	RuleDocumentationDocument,
	RuleDocumentationInventory,
	RuleDocumentationPathInventory,
} from "documentation_validation/types";
import type { SystemFailureClassificationContract } from "src/analysis_protocols";
import { PYTHON_LANGUAGE, RULE_DOCUMENT_DIRECTORY, TYPESCRIPT_LANGUAGE } from "src/constants";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";
import { SYSTEM_FAILURE_CODES } from "src/io/constants";
import type { ProjectSourceIOContract } from "src/source_protocols";

/** Responsibilities: _rule document collection_, _example indexing_. **/
export class RuleDocumentationCatalog {
	private readonly _root: string;
	private readonly _paths: RuleDocumentationPaths;
	private readonly _loop_expander: MarkdownLoopExpander;
	private readonly _source_io: ProjectSourceIOContract;

	/** Responsibilities: _rule document folder language_. **/
	private document_languages(file_path: string): readonly DocumentationLanguage[] {
		const documentation_root = join(this._root, RULE_DOCUMENT_DIRECTORY);
		const document_relative_path = relative(documentation_root, join(this._root, file_path));
		for (const folder of document_relative_path.split(sep)) {
			if (folder === TYPESCRIPT_LANGUAGE) {
				return [DocumentationLanguage.TYPESCRIPT];
			}
			if (folder === PYTHON_LANGUAGE) {
				return [DocumentationLanguage.PYTHON];
			}
			break;
		}
		return [];
	}

	/** Responsibilities: _source document line count_. **/
	private document_line_count(source_text: string): number {
		if (source_text.length === 0) {
			return 0;
		}
		const lines = source_text.split(/\r\n|\n|\r/u);
		if (lines.at(-1) === "") {
			lines.pop();
		}
		return lines.length;
	}

	/** Responsibilities: _Markdown template expansion_. **/
	private expanded_document(source_text: string): string {
		if (!this._loop_expander.contains_template(source_text)) {
			return source_text;
		}
		return this._loop_expander.expand(source_text);
	}

	/** Responsibilities: _rule example indexing_. **/
	private examples_by_kind(rule_id: string, text: string): Map<ExampleKind, readonly DocumentationExample[]> {
		const example_document = new RuleDocumentationExamples(text);
		const example_data = new Map<ExampleKind, readonly RuleDocumentationExampleData[]>([
			[ExampleKind.BAD, example_document.bad_examples()],
			[ExampleKind.GOOD, example_document.good_examples()],
		]);
		const examples = new Map<ExampleKind, readonly DocumentationExample[]>();
		for (const [kind, data] of example_data) {
			examples.set(
				kind,
				data.map((example) => ({ rule_id, ...example })),
			);
		}
		return examples;
	}

	/** Responsibilities: _rule document loading_. **/
	private describe_path(document_path: RuleDocumentPath): RuleDocumentationDocument {
		const source = this._source_io.source_text(join(this._root, document_path.file_path));
		const text = this.expanded_document(source);
		const languages = this.document_languages(document_path.file_path);
		const examples = this.examples_by_kind(document_path.rule_id, text);
		return {
			rule_id: document_path.rule_id,
			file_path: document_path.file_path,
			text,
			line_count: this.document_line_count(source),
			languages,
			examples,
		};
	}

	/** Responsibilities: _requested rule document selection_. **/
	private requested_documents(
		inventory: RuleDocumentationPathInventory,
		requested_rules: readonly string[],
	): readonly RuleDocumentPath[] {
		if (requested_rules.length === 0) {
			return inventory.present_documents;
		}
		return inventory.present_documents.filter((document) => requested_rules.includes(document.rule_id));
	}

	/** Responsibilities: _catalog dependency ownership_. **/
	public constructor(root: string, rule_ids: readonly string[], source_io: ProjectSourceIOContract) {
		this._root = root;
		this._source_io = source_io;
		this._paths = new RuleDocumentationPaths(root, rule_ids, source_io);
		const boundary_failures: SystemFailureClassificationContract = new BoundaryFailureClassifier(SYSTEM_FAILURE_CODES);
		this._loop_expander = new MarkdownLoopExpander(boundary_failures);
	}

	/** Responsibilities: _catalog rule documentation access_. **/
	public describe_rule(rule_id: string): RuleDocumentationDocument {
		return this.describe_path({ rule_id, file_path: this._paths.primary_path(rule_id) });
	}

	/** Responsibilities: _complete rule inventory_. **/
	public collect(requested_rules: readonly string[]): RuleDocumentationInventory {
		const inventory = this._paths.scan();
		const selected_documents = this.requested_documents(inventory, requested_rules);
		const documents = selected_documents.map((document_path) => {
			if (document_path.file_path === this._paths.primary_path(document_path.rule_id)) {
				return this.describe_rule(document_path.rule_id);
			}
			return this.describe_path(document_path);
		});
		return {
			documents,
			unknown_rules: requested_rules.filter((rule_id) => !inventory.registered_rule_ids.has(rule_id)),
			invalid_entries: inventory.invalid_entries,
			missing_documents: inventory.missing_documents,
		};
	}
}
