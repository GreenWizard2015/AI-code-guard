import type { TypeScriptProjectAnalysisContract } from "src/ast_verifier_protocols";
import type { ProjectSourceAnalysisOptions } from "src/project_analysis_types";
import type { ViolationContract } from "src/reporting_protocols";
import type {
	CallableProjectViolationCollector,
	ProjectViolationsByScope,
} from "src/rules/typescript/syntax-rules/types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";

/** Responsibilities: _project rule result caching_, _source violation delivery_. **/
export class TypeScriptProjectRuleCache {
	private readonly _violations_by_scope: ProjectViolationsByScope;

	/** Responsibilities: _scope result collection_. **/
	private grouped_violations(
		scope: ProjectSourceAnalysisOptions,
		collect: CallableProjectViolationCollector,
	): ReadonlyMap<string, readonly ViolationContract[]> {
		const cached = this._violations_by_scope.get(scope);
		if (cached !== undefined) {
			return cached;
		}
		const grouped = new Map<string, ViolationContract[]>();
		for (const violation of collect()) {
			const file_violations = grouped.get(violation.file()) ?? [];
			file_violations.push(violation);
			grouped.set(violation.file(), file_violations);
		}
		this._violations_by_scope.set(scope, grouped);
		return grouped;
	}

	/** Responsibilities: _project rule cache initialization_. **/
	public constructor() {
		this._violations_by_scope = new WeakMap();
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
		const grouped = this.grouped_violations(rule_scope.project_analysis(), collect_violations);
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
