import { join } from "node:path";
import { RULE_DOCUMENT_PATHS_BY_ID } from "src/constants";

/** Responsibilities: _rule document registry lookup_, _language-qualified source selection_. **/
export class TaskRuleDocumentCatalog {
	private readonly project_root: string;

	/** Responsibilities: _document root ownership_. **/
	public constructor(project_root: string) {
		this.project_root = project_root;
	}

	/** Responsibilities: _rule documentation catalog_. **/
	public rule_documents(rule_id: string): readonly string[] {
		const paths = RULE_DOCUMENT_PATHS_BY_ID.get(rule_id);
		if (paths === undefined) {
			throw new Error(`Rule "${rule_id}" is not registered for documentation.`);
		}
		return paths;
	}

	/** Responsibilities: _language-specific rule document source_. **/
	public source_path(rule_label: string): string {
		const suffix_start = rule_label.search(/\[(?:typescript|python)\]$/u);
		let rule_id = rule_label;
		let language = "";
		if (suffix_start >= 0) {
			rule_id = rule_label.slice(0, suffix_start);
			language = rule_label.slice(suffix_start + 1, -1);
		}
		for (const path of this.rule_documents(rule_id)) {
			if (language.length === 0) {
				return join(this.project_root, path);
			}
			if (path.includes(`/${language}/`)) {
				return join(this.project_root, path);
			}
		}
		throw new Error(`Rule "${rule_label}" has no registered documentation path for ${language}.`);
	}
}
