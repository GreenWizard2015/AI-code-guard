import type { ASTSourceRuleContract, TypeScriptProjectAnalysisContract } from "src/ast_verifier_protocols";
import { TYPESCRIPT_LANGUAGE } from "src/constants";
import { ProjectSourcePython } from "src/core/project-source/project_source_python";
import { SharedParameterAdapter } from "src/metrics/shared_parameter/shared_parameter_adapter";
import { SharedParameterAnalyzer } from "src/metrics/shared_parameter/shared_parameter_analyzer";
import { SharedParameterReporter } from "src/metrics/shared_parameter/shared_parameter_reporter";
import type { AnalyzedCallable } from "src/metrics/types";
import type { ViolationContract } from "src/reporting_protocols";
import { MODULE_FUNCTION_KIND } from "src/rules/constants";
import { TypeScriptProjectRuleCache } from "src/rules/typescript/syntax-rules/ast/verifier/project-rules/type_script_project_rule_cache";
import type {
	ModuleFunctionAnalysis,
	ProjectFunctionAnalysisRequest,
	ProjectTypeSources,
} from "src/rules/typescript/syntax-rules/types";
import { SharedParameterTypeSources } from "src/shared_parameter_type_sources";
import type { LintProjectContextContract } from "src/shared_services_protocols";
import type { LintSourceRecordData } from "src/source_types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _project module function analysis_, _shared parameter violation reporting_. **/
export class TypeScriptProjectSharedParameterRules implements ASTSourceRuleContract, TypeScriptProjectAnalysisContract {
	private readonly _cache: TypeScriptProjectRuleCache;

	/** Responsibilities: _project type identity collection_. **/
	private type_sources(
		root: string,
		context: LintProjectContextContract,
		sources: readonly LintSourceRecordData[],
	): ProjectTypeSources {
		const file_paths = sources.map((source) => source.absolute_path);
		const import_context = {
			root,
			files: new Set(file_paths),
			resolver: new ProjectSourcePython(root),
		};
		const collection = new SharedParameterTypeSources(root, file_paths, context, import_context);
		return collection.collect();
	}

	/** Responsibilities: _module function analysis_. **/
	private module_function_analysis(request: ProjectFunctionAnalysisRequest): ModuleFunctionAnalysis {
		const { scope, project_types } = request;
		const sources = scope.context.files().filter((source) => source.language === TYPESCRIPT_LANGUAGE);
		return {
			sources,
			type_sources: this.type_sources(scope.root, scope.context, sources),
			project_types,
		};
	}

	/** Responsibilities: _project module callable collection_. **/
	private module_function_callables(analysis: ModuleFunctionAnalysis): AnalyzedCallable[] {
		return analysis.sources
			.filter((source) => source.file_name.product())
			.flatMap((source) => {
				const adapter = new SharedParameterAdapter({
					file: source.relative_path,
					kind: MODULE_FUNCTION_KIND,
					nodes: source.normalized_ast.source.functions,
					type_sources: analysis.type_sources,
					project_types: analysis.project_types,
					reference_aliases: source.normalized_ast.references.reference_aliases,
					language: TYPESCRIPT_LANGUAGE,
				});
				return adapter.callables();
			});
	}

	/** Responsibilities: _shared parameter violation reporting_. **/
	private report_shared_parameters(callables: AnalyzedCallable[]): ViolationContract[] {
		const analyzer = new SharedParameterAnalyzer(callables);
		const candidates = analyzer.collect_candidates();
		const reporter = new SharedParameterReporter(candidates);
		return reporter.violations();
	}

	/** Responsibilities: _shared-parameter rule initialization_. **/
	public constructor() {
		this._cache = new TypeScriptProjectRuleCache();
	}

	/** Responsibilities: _project source rule activation_. **/
	public active_for(): boolean {
		return true;
	}

	/** Responsibilities: _project source dispatch_. **/
	public verify(parameter_request: TypeScriptNodeVerificationRequest): void {
		if (ts.isSourceFile(parameter_request.node)) {
			this._cache.append_for_source(parameter_request, this);
		}
	}

	/** Responsibilities: _project shared parameter reporting_. **/
	public collect_project_violations(parameter_request: TypeScriptNodeVerificationRequest): ViolationContract[] {
		const state = parameter_request.context.state();
		const rule_scope = state.project.rule_scope;
		if (!rule_scope.project_scope()) {
			return [];
		}
		return state.analysis.stage_timer.measure("rule.shared-parameter.typescript-module-functions", () => {
			const analysis_request = {
				scope: rule_scope.project_analysis(),
				project_types: state.project.project_names.project_type_names,
			};
			const analysis = this.module_function_analysis(analysis_request);
			const callables = this.module_function_callables(analysis);
			return this.report_shared_parameters(callables);
		});
	}
}
