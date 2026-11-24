import type { ASTSourceRuleContract, TypeScriptProjectAnalysisContract } from "src/ast_verifier_protocols";
import { TYPESCRIPT_LANGUAGE } from "src/constants";
import type { ViolationContract } from "src/reporting_protocols";
import { ModulePlacementAnalyzer } from "src/rules/architecture/module_placement_analyzer";
import { TypeScriptProjectRuleResultCache } from "src/rules/typescript/syntax-rules/ast/verifier/project-rules/type_script_project_rule_result_cache";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _project module placement_, _project violation reporting_. **/
export class TypeScriptModulePlacementRule implements ASTSourceRuleContract, TypeScriptProjectAnalysisContract {
	private readonly _results: TypeScriptProjectRuleResultCache;

	/** Responsibilities: _project placement rule setup_. **/
	public constructor() {
		this._results = new TypeScriptProjectRuleResultCache();
	}

	/** Responsibilities: _project placement activation_. **/
	public active_for(): boolean {
		return true;
	}

	/** Responsibilities: _project placement reporting_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		if (!ts.isSourceFile(request.node)) {
			return;
		}
		const rule_scope = request.context.state().project.rule_scope;
		if (!rule_scope.project_scope()) {
			return;
		}
		const scope = rule_scope.project_analysis();
		const grouped = this._results.grouped(scope, this.constructor.name, () => {
			const by_file = new Map<string, ViolationContract[]>();
			for (const violation of this.collect_project_violations(request)) {
				const violations = by_file.get(violation.file()) ?? [];
				violations.push(violation);
				by_file.set(violation.file(), violations);
			}
			return by_file;
		});
		for (const violation of grouped.get(request.context.state().source.file) ?? []) {
			request.context.append_violation(violation);
		}
	}

	/** Responsibilities: _complete project placement analysis_. **/
	public collect_project_violations(request: TypeScriptNodeVerificationRequest): ViolationContract[] {
		const rule_scope = request.context.state().project.rule_scope;
		if (!rule_scope.project_scope()) {
			return [];
		}
		const analyzer = new ModulePlacementAnalyzer(rule_scope.project_analysis());
		const importers = analyzer.collect_importers();
		return analyzer.collect_language_violations(importers, TYPESCRIPT_LANGUAGE);
	}
}
