import type { AstLanguage } from "src/model/ast/normalized_ast_types";
import type { ProjectSourceAnalysisOptions } from "src/project_analysis_types";
import type { LintSourceRecordData } from "src/source_types";
import type { TypeScriptRuleScopeContract } from "src/types";

/** Responsibilities: _project scope_, _language-specific source selection_. **/
export class TypeScriptRuleScope implements TypeScriptRuleScopeContract {
	private readonly _analysis: ProjectSourceAnalysisOptions;
	private readonly _sources_by_language: Map<AstLanguage, readonly LintSourceRecordData[]>;

	/** Responsibilities: _project scope initialization_. **/
	public constructor(analysis: ProjectSourceAnalysisOptions) {
		this._analysis = analysis;
		this._sources_by_language = new Map();
	}

	/** Responsibilities: _project scope capability_. **/
	public project_scope(): boolean {
		return true;
	}

	/** Responsibilities: _project analysis access_. **/
	public project_analysis(): ProjectSourceAnalysisOptions {
		return this._analysis;
	}

	/** Responsibilities: _language-specific source selection_. **/
	public source_files(language: AstLanguage): readonly LintSourceRecordData[] {
		const cached_sources = this._sources_by_language.get(language);
		if (cached_sources !== undefined) {
			return cached_sources;
		}
		const sources: LintSourceRecordData[] = [];
		for (const source of this._analysis.context.files()) {
			if (source.language === language) {
				sources.push(source);
			}
		}
		this._sources_by_language.set(language, sources);
		return sources;
	}
}
