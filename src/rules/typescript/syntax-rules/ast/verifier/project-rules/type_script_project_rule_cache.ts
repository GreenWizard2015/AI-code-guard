import type { TypeScriptProjectAnalysisContract } from "src/ast_verifier_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import { TypeScriptProjectRuleResultCache } from "src/rules/typescript/syntax-rules/ast/verifier/project-rules/type_script_project_rule_result_cache";
import type { CallableProjectViolationCollector } from "src/rules/typescript/syntax-rules/types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";

/** Responsibilities: _source violation selection_, _source violation delivery_. **/
export class TypeScriptProjectRuleCache {
	private readonly _results: TypeScriptProjectRuleResultCache;

	/** Responsibilities: _project violation grouping_. **/
	private group_project_violations(violations: readonly ViolationContract[]): Map<string, ViolationContract[]> {
		const grouped = new Map<string, ViolationContract[]>();
		for (const violation of violations) {
			const file_violations = grouped.get(violation.file()) ?? [];
			file_violations.push(violation);
			grouped.set(violation.file(), file_violations);
		}
		return grouped;
	}

	/** Responsibilities: _project rule cache initialization_. **/
	public constructor() {
		this._results = new TypeScriptProjectRuleResultCache();
	}

	/** Responsibilities: _source violation lookup_. **/
	public violations_for_source(
		request: TypeScriptNodeVerificationRequest,
		analysis: TypeScriptProjectAnalysisContract,
	): readonly ViolationContract[] {
		const {
			source: { file },
			project: { rule_scope },
		} = request.context.state();
		if (!rule_scope.project_scope()) {
			return [];
		}
		const collect_violations: CallableProjectViolationCollector = () => analysis.collect_project_violations(request);
		const scope = rule_scope.project_analysis();
		const grouped = this._results.grouped(scope, analysis.constructor.name, () =>
			this.group_project_violations(collect_violations()),
		);
		const source_violations = grouped.get(file);
		if (source_violations === undefined) {
			return [];
		}
		return source_violations;
	}

	/** Responsibilities: _source violation delivery_. **/
	public append_for_source(
		request: TypeScriptNodeVerificationRequest,
		analysis: TypeScriptProjectAnalysisContract,
	): void {
		for (const violation of this.violations_for_source(request, analysis)) {
			request.context.append_violation(violation);
		}
	}
}
