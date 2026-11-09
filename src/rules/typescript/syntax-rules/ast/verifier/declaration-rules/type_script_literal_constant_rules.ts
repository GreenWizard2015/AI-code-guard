import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { TYPESCRIPT_LANGUAGE } from "src/constants";
import { RULE_IDS } from "src/linting/constants";
import { LiteralConstantReferenceIndex } from "src/literal_constant_reference_index";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ViolationContract } from "src/reporting_protocols";
import type { ProjectContextViolationsByScope, ProjectViolationsByFile } from "src/rules/typescript/syntax-rules/types";
import type { LintProjectContextContract } from "src/shared_services_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _TypeScript project literal verification_, _source diagnostics_. **/
export class TypeScriptLiteralConstantRules implements ASTSourceRuleContract {
	private readonly _violations_by_project: ProjectContextViolationsByScope;
	private readonly _constant_rule: DiagnosticRule;
	private readonly _repeated_rule: DiagnosticRule;

	/** Responsibilities: _project file violation lookup_. **/
	private violations_by_file(
		project: LintProjectContextContract,
		stage_timer: LintStageTimerContract,
	): ProjectViolationsByFile {
		const cached = this._violations_by_project.get(project);
		if (cached !== undefined) {
			return cached;
		}
		const grouped = this.collect_project_violations(project, stage_timer);
		this._violations_by_project.set(project, grouped);
		return grouped;
	}

	/** Responsibilities: _project literal violation collection_. **/
	private collect_project_violations(
		project: LintProjectContextContract,
		stage_timer: LintStageTimerContract,
	): Map<string, ViolationContract[]> {
		const sources = project
			.files()
			.filter((source) => source.language === TYPESCRIPT_LANGUAGE && source.file_name.product());
		const index = new LiteralConstantReferenceIndex(sources, this._constant_rule, this._repeated_rule, stage_timer);
		index.register_constants();
		index.register_references();
		const grouped = new Map<string, ViolationContract[]>();
		for (const violation of index.collect_violations()) {
			const file_violations = grouped.get(violation.file()) ?? [];
			file_violations.push(violation);
			grouped.set(violation.file(), file_violations);
		}
		return grouped;
	}

	/** Responsibilities: _project literal diagnostic publication_. **/
	private append_project_violations(request: TypeScriptNodeVerificationRequest): void {
		const { file } = request.context.state().source;
		const { rule_scope } = request.context.state().project;
		if (!rule_scope.project_scope()) {
			return;
		}
		const violations_by_file = this.violations_by_file(
			rule_scope.project_analysis().context,
			request.context.state().analysis.stage_timer,
		);
		const violations = violations_by_file.get(file);
		if (violations === undefined) {
			return;
		}
		for (const violation of violations) {
			request.context.append_violation(violation);
		}
	}

	/** Responsibilities: _literal constant rule initialization_. **/
	public constructor() {
		this._violations_by_project = new WeakMap();
		this._constant_rule = new DiagnosticRule(RULE_IDS.literal_constant_reuse);
		this._repeated_rule = new DiagnosticRule(RULE_IDS.repeated_literal);
	}

	/** Responsibilities: _source literal activation_. **/
	public active_for(source_code: string): boolean {
		return source_code.includes("'") || source_code.includes('"') || source_code.includes("`");
	}

	/** Responsibilities: _project literal diagnostic publication_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		if (!ts.isSourceFile(request.node)) {
			return;
		}
		this.append_project_violations(request);
	}
}
