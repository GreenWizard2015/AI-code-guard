import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { TEST_PATH_SUFFIXES, TYPESCRIPT_LANGUAGE } from "src/constants";
import { TypeScriptContextClassFieldAnalysis } from "src/model/typescript/type_script_context_class_field_analysis";
import type { ViolationContract } from "src/reporting_protocols";
import { ClassReferenceMetric } from "src/rules/classes/class_reference_metric";
import { TypeScriptProjectRuleResultCache } from "src/rules/typescript/syntax-rules/ast/verifier/project-rules/type_script_project_rule_result_cache";
import type {
	ProjectClassFieldAnalysisRequest,
	ProjectRuleResultCacheContract,
} from "src/rules/typescript/syntax-rules/ast/verifier/project-rules/types";
import { TestPathSyntax } from "src/test_path_syntax";
import type { RuleContextContract } from "src/types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _project TypeScript class-field diagnostics_, _class-reference metrics_. **/
export class TypeScriptProjectClassFieldRules implements ASTSourceRuleContract {
	private readonly _violations_by_scope: ProjectRuleResultCacheContract;

	/** Responsibilities: _project violation indexing_. **/
	private index_project_violations(request: ProjectClassFieldAnalysisRequest): Map<string, ViolationContract[]> {
		const { scope, stage_timer } = request;
		const analysis = new TypeScriptContextClassFieldAnalysis(scope.project_files(), scope.root(), scope.context());
		const violations = stage_timer.measure("rule.class-field-import.typescript", () => analysis.collect());
		violations.push(...this.class_reference_violations(request));
		return this.group_by_file(violations);
	}

	/** Responsibilities: _project class-reference findings_. **/
	private class_reference_violations(request: ProjectClassFieldAnalysisRequest): ViolationContract[] {
		const { scope, stage_timer } = request;
		const sources = scope
			.context()
			.files()
			.filter((source) => source.language === TYPESCRIPT_LANGUAGE);
		const path_syntax = new TestPathSyntax(TEST_PATH_SUFFIXES);
		const reference_metric = new ClassReferenceMetric(path_syntax);
		return reference_metric.language_class_refs(sources, TYPESCRIPT_LANGUAGE, stage_timer);
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

	/** Responsibilities: _class-field violation publication_. **/
	private append_file_violations(context: RuleContextContract, violations: readonly ViolationContract[]): void {
		for (const violation of violations) {
			context.append_violation(violation);
		}
	}

	/** Responsibilities: _project class-field verification_. **/
	private verify_file(request: TypeScriptNodeVerificationRequest, file: string): void {
		const state = request.context.state();
		const rule_scope = state.project.rule_scope;
		if (!rule_scope.project_scope()) {
			return;
		}
		const project_analysis = rule_scope.project_analysis();
		const analysis_request: ProjectClassFieldAnalysisRequest = {
			scope: project_analysis,
			stage_timer: state.analysis.stage_timer,
		};
		const violations_by_file = this._violations_by_scope.grouped(
			project_analysis,
			TypeScriptProjectClassFieldRules.name,
			() => this.index_project_violations(analysis_request),
		);
		this.append_file_violations(request.context, violations_by_file.get(file) ?? []);
	}

	/** Responsibilities: _project class-field rule initialization_. **/
	public constructor() {
		this._violations_by_scope = new TypeScriptProjectRuleResultCache();
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
		const file = request.context.state().source.file;
		this.verify_file(request, file);
	}
}
