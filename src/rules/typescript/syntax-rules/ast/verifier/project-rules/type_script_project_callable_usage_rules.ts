import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import type { TypeScriptProjectAnalysisContract } from "src/ast_verifier_protocols";
import { CallableUsage } from "src/callable_usage";
import { TYPESCRIPT_LANGUAGE } from "src/constants";
import type { CallableUsageAnalysisOptions } from "src/contracts/types/composition_types";
import { ProjectSourcePython } from "src/core/project-source/project_source_python";
import type { ViolationContract } from "src/reporting_protocols";
import { TypeScriptProjectRuleCache } from "src/rules/typescript/syntax-rules/ast/verifier/project-rules/type_script_project_rule_cache";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { TypeScriptRuleScopeContract } from "src/types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _project callable analysis_, _callable violation reporting_. **/
export class TypeScriptProjectCallableUsageRules implements ASTSourceRuleContract, TypeScriptProjectAnalysisContract {
	private readonly _cache: TypeScriptProjectRuleCache;

	/** Responsibilities: _callable analysis input preparation_. **/
	private analysis_options(
		rule_scope: TypeScriptRuleScopeContract,
		stage_timer: LintStageTimerContract,
	): CallableUsageAnalysisOptions {
		const scope = rule_scope.project_analysis();
		const sources = rule_scope.source_files(TYPESCRIPT_LANGUAGE);
		const files = sources.map((source) => source.absolute_path);
		const import_context = {
			root: scope.root,
			files: new Set(files),
			resolver: new ProjectSourcePython(scope.root),
		};
		return {
			project_root: scope.root,
			project_files: files,
			import_context,
			project_source_scanner: scope.scanner,
			source_asts: new Map(),
			sources,
			stage_timer,
		};
	}

	/** Responsibilities: _project callable rule initialization_. **/
	public constructor() {
		this._cache = new TypeScriptProjectRuleCache();
	}

	/** Responsibilities: _project callable rule activation_. **/
	public active_for(): boolean {
		return true;
	}

	/** Responsibilities: _callable usage reporting_. **/
	public verify(callable_request: TypeScriptNodeVerificationRequest): void {
		if (ts.isSourceFile(callable_request.node)) {
			this._cache.append_for_source(callable_request, this);
		}
	}

	/** Responsibilities: _project callable violation collection_. **/
	public collect_project_violations(callable_request: TypeScriptNodeVerificationRequest): ViolationContract[] {
		const rule_scope = callable_request.context.state().project.rule_scope;
		if (!rule_scope.project_scope()) {
			return [];
		}
		const stage_timer = callable_request.context.state().analysis.stage_timer;
		const analysis_options = this.analysis_options(rule_scope, stage_timer);
		const analysis = new CallableUsage(analysis_options);
		const typescript_files = new Set(analysis_options.sources.map((source) => source.relative_path));
		return analysis.collect_timed_usage().filter((violation) => typescript_files.has(violation.file()));
	}
}
