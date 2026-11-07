import { RULE_DOCUMENT_PATHS_BY_ID } from "src/constants";
import { LintFileName } from "src/core/context/lint_file_name";
import type { AstLanguage } from "src/model/ast/normalized_ast_types";
import type { ViolationContract } from "src/reporting_protocols";

/** Responsibilities: _rule language labels_, _diagnostic grouping_. **/
export class TaskRuleLanguageGroups {
	private readonly _violations: readonly ViolationContract[];
	private readonly _language_by_rule: Map<string, AstLanguage>;
	private readonly _mixed_language_rules: Set<string>;

	/** Responsibilities: _per-rule language indexing_. **/
	private index_languages(): void {
		for (const violation of this._violations) {
			const file_name = new LintFileName(violation.file());
			const language = file_name.language();
			const previous_language = this._language_by_rule.get(violation.rule_id());
			if (previous_language === undefined) {
				this._language_by_rule.set(violation.rule_id(), language);
			} else if (previous_language !== language) {
				this._mixed_language_rules.add(violation.rule_id());
			}
		}
	}

	/** Responsibilities: _diagnostic language index initialization_. **/
	public constructor(violations: readonly ViolationContract[]) {
		this._violations = violations;
		this._language_by_rule = new Map<string, AstLanguage>();
		this._mixed_language_rules = new Set<string>();
	}

	/** Responsibilities: _language-qualified diagnostic label_. **/
	public rule_label(violation: ViolationContract): string {
		let language_qualified = this._mixed_language_rules.has(violation.rule_id());
		if (!language_qualified) {
			const language_documents = RULE_DOCUMENT_PATHS_BY_ID.get(violation.rule_id());
			if (language_documents !== undefined) {
				language_qualified = language_documents.length > 1;
			}
		}
		if (language_qualified) {
			const file_name = new LintFileName(violation.file());
			const language = file_name.language();
			return `${violation.rule_id()}[${language}]`;
		}
		return violation.rule_id();
	}

	/** Responsibilities: _rule-language diagnostic groups_. **/
	public grouped_violations(): Map<string, ViolationContract[]> {
		this.index_languages();
		const groups = new Map<string, ViolationContract[]>();
		for (const violation of this._violations) {
			const rule_label = this.rule_label(violation);
			let group = groups.get(rule_label);
			if (group === undefined) {
				group = [];
				groups.set(rule_label, group);
			}
			group.push(violation);
		}
		return groups;
	}
}
