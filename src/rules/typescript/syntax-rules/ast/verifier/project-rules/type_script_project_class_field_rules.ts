import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { TEST_PATH_SUFFIXES, TYPESCRIPT_LANGUAGE } from "src/constants";
import { TypeScriptContextClassFieldAnalysis } from "src/model/type_script_context_class_field_analysis";
import type { ProjectSourceAnalysisOptions } from "src/project_analysis_types";
import type { ViolationContract } from "src/reporting_protocols";
import { ClassReferenceMetric } from "src/rules/class_reference_metric";
import type { ProjectViolationsByScope } from "src/rules/typescript/syntax-rules/types";
import { TestPathSyntax } from "src/test_path_syntax";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _project TypeScript class-field diagnostics_, _class-reference metrics_. **/
export class TypeScriptProjectClassFieldRules implements ASTSourceRuleContract {
	private readonly _violations_by_scope: ProjectViolationsByScope;

	/** Responsibilities: _project class-field diagnostic index_. **/
	private violations_by_file(scope: ProjectSourceAnalysisOptions): ReadonlyMap<string, readonly ViolationContract[]> {
		const cached = this._violations_by_scope.get(scope);
		if (cached !== undefined) {
			return cached;
		}
		const grouped = this.index_project_violations(scope);
		this._violations_by_scope.set(scope, grouped);
		return grouped;
	}

	/** Responsibilities: _project violation indexing_. **/
	private index_project_violations(scope: ProjectSourceAnalysisOptions): Map<string, ViolationContract[]> {
		const analysis = new TypeScriptContextClassFieldAnalysis(scope.project_files, scope.root, scope.context);
		const violations = analysis.collect();
		const sources = scope.context.files().filter((source) => source.language === TYPESCRIPT_LANGUAGE);
		const path_syntax = new TestPathSyntax(TEST_PATH_SUFFIXES);
		const reference_metric = new ClassReferenceMetric(path_syntax);
		const reference_violations = reference_metric.language_class_refs(sources, TYPESCRIPT_LANGUAGE);
		violations.push(...reference_violations);
		return this.group_by_file(violations);
	}

	/** Responsibilities: _violations by source-file grouping_. **/
	private group_by_file(violations: readonly ViolationContract[]): Map<string, ViolationContract[]> {
		const grouped = new Map<string, ViolationContract[]>();
		for (const violation of violations) {
			const file_violations = grouped.get(violation.file()) ?? [];
			file_violations.push(violation);
			grouped.set(violation.file(), file_violations);
		}
		return grouped;
	}

	/** Responsibilities: _project class-field rule initialization_. **/
	public constructor() {
		this._violations_by_scope = new WeakMap();
	}

	/** Responsibilities: _non-empty TypeScript source activation_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}

	/** Responsibilities: _project class-field diagnostic publication_. **/
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
