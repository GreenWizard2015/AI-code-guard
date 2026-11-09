import { LiteralConstantReferenceIndex } from "src/literal_constant_reference_index";
import type { AstLanguage } from "src/model/ast/normalized_ast_types";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintProjectContextContract } from "src/shared_services_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { LintSourceRecordData } from "src/source_types";

/** Responsibilities: _project literal constant matching_, _reuse diagnostics_. **/
export class LiteralConstantRules {
	private readonly _rule: RuleContract;
	private readonly _repeated_rule: RuleContract;
	private readonly _stage_timer: LintStageTimerContract;

	/** Responsibilities: _production source selection_. **/
	private production(source: LintSourceRecordData): boolean {
		const file_name = source.file_name;
		if (!file_name.product()) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _literal diagnostics dependency injection_. **/
	public constructor(rule: RuleContract, repeated_rule: RuleContract, stage_timer: LintStageTimerContract) {
		this._rule = rule;
		this._repeated_rule = repeated_rule;
		this._stage_timer = stage_timer;
	}

	/** Responsibilities: _production source collection_. **/
	public production_sources(context: LintProjectContextContract, language: AstLanguage): LintSourceRecordData[] {
		const sources: LintSourceRecordData[] = [];
		for (const source of context.files()) {
			if (!this.production(source)) {
				continue;
			}
			if (source.language !== language) {
				continue;
			}
			sources.push(source);
		}
		return sources;
	}

	/** Responsibilities: _project literal constant diagnostics_. **/
	public violations_for_language(context: LintProjectContextContract, language: AstLanguage): ViolationContract[] {
		const sources = this.production_sources(context, language);
		const index = new LiteralConstantReferenceIndex(sources, this._rule, this._repeated_rule, this._stage_timer);
		index.register_constants();
		index.register_references();
		return index.collect_violations();
	}
}
