import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { TYPESCRIPT_LANGUAGE } from "src/constants";
import type { ProjectSourceAnalysisOptions } from "src/project_analysis_types";
import type { ViolationContract } from "src/reporting_protocols";
import { ProductionTestImportAnalyzer } from "src/rules/architecture/production_test_import_analyzer";
import type { ProjectViolationsByFile, ProjectViolationsByScope } from "src/rules/typescript/syntax-rules/types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _production import boundary_, _scope violation caching_. **/
export class TypeScriptProductionTestImportRule implements ASTSourceRuleContract {
	private readonly _violations_by_scope: ProjectViolationsByScope;

	/** Responsibilities: _scope violation collection_. **/
	private violations_by_file(scope: ProjectSourceAnalysisOptions): ProjectViolationsByFile {
		const cached = this._violations_by_scope.get(scope);
		if (cached !== undefined) {
			return cached;
		}
		const analyzer = new ProductionTestImportAnalyzer(scope);
		const grouped = new Map<string, ViolationContract[]>();
		for (const violation of analyzer.language_violations(TYPESCRIPT_LANGUAGE)) {
			const file_violations = grouped.get(violation.file()) ?? [];
			file_violations.push(violation);
			grouped.set(violation.file(), file_violations);
		}
		this._violations_by_scope.set(scope, grouped);
		return grouped;
	}

	/** Responsibilities: _scope cache initialization_. **/
	public constructor() {
		this._violations_by_scope = new WeakMap();
	}

	/** Responsibilities: _rule activation_. **/
	public active_for(_: string): boolean {
		return true;
	}

	/** Responsibilities: _test import reporting_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		if (!ts.isSourceFile(request.node)) {
			return;
		}
		const {
			source: { file },
			project: { rule_scope },
		} = request.context.state();
		if (!rule_scope.project_scope()) {
			return;
		}
		for (const violation of this.violations_by_file(rule_scope.project_analysis()).get(file) ?? []) {
			request.context.append_violation(violation);
		}
	}
}
