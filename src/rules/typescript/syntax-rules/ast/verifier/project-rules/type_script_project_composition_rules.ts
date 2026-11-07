import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import type { TypeScriptProjectAnalysisContract } from "src/ast_verifier_protocols";
import { TYPESCRIPT_LANGUAGE } from "src/constants";
import { TEST_PATH_SUFFIXES } from "src/constants";
import { ProjectSourcePython } from "src/core/project-source/project_source_python";
import { CompositionAnalyzer } from "src/linting/composition/composition_analyzer";
import { CompositionModel } from "src/linting/composition/composition_model";
import type { ProjectSourceAnalysisOptions } from "src/project_analysis_types";
import type { ViolationContract } from "src/reporting_protocols";
import { TypeScriptProjectRuleCache } from "src/rules/typescript/syntax-rules/ast/verifier/project-rules/type_script_project_rule_cache";
import type { LintSourceRecordData } from "src/source_types";
import { TestPathSyntax } from "src/test_path_syntax";
import { TestPathKind } from "src/types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _composition graph analysis_, _project violation reporting_. **/
export class TypeScriptProjectCompositionRules implements ASTSourceRuleContract, TypeScriptProjectAnalysisContract {
	private readonly _cache: TypeScriptProjectRuleCache;

	/** Responsibilities: _composition graph violation collection_. **/
	private composition_violations(
		scope: ProjectSourceAnalysisOptions,
		sources: readonly LintSourceRecordData[],
		typescript_sources: readonly LintSourceRecordData[],
	): ViolationContract[] {
		const source_files = new Map(
			sources
				.filter((source) => source.language === TYPESCRIPT_LANGUAGE)
				.map((source) => [source.absolute_path, source.typescript_ast.source_file_node()] as const),
		);
		const import_context = {
			root: scope.root,
			files: new Set(scope.project_files),
			resolver: new ProjectSourcePython(scope.root),
		};
		const model = new CompositionModel(scope.root, import_context, source_files, false, scope.context.source_io());
		const graph = model.class_graph(typescript_sources);
		const analyzer = new CompositionAnalyzer(graph, scope.root);
		return analyzer.violations();
	}

	/** Responsibilities: _production composition source selection_. **/
	private production_files(typescript_sources: readonly LintSourceRecordData[]): Set<string> {
		const test_path_syntax = new TestPathSyntax(TEST_PATH_SUFFIXES);
		return new Set(
			typescript_sources
				.filter((source) => !test_path_syntax.classify(source.relative_path).has(TestPathKind.TestFile))
				.map((source) => source.relative_path),
		);
	}

	/** Responsibilities: _project composition rule initialization_. **/
	public constructor() {
		this._cache = new TypeScriptProjectRuleCache();
	}

	/** Responsibilities: _project composition rule activation_. **/
	public active_for(): boolean {
		return true;
	}

	/** Responsibilities: _composition usage reporting_. **/
	public verify(composition_request: TypeScriptNodeVerificationRequest): void {
		if (ts.isSourceFile(composition_request.node)) {
			this._cache.append_for_source(composition_request, this);
		}
	}

	/** Responsibilities: _project composition violation collection_. **/
	public collect_project_violations(composition_request: TypeScriptNodeVerificationRequest): ViolationContract[] {
		const rule_scope = composition_request.context.state().project.rule_scope;
		if (!rule_scope.project_scope()) {
			return [];
		}
		const scope = rule_scope.project_analysis();
		const sources = scope.context.files();
		const typescript_sources = sources.filter(
			(source) => source.language === TYPESCRIPT_LANGUAGE && source.file_name.product(),
		);
		const all_violations = this.composition_violations(scope, sources, typescript_sources);
		const production_files = this.production_files(typescript_sources);
		return all_violations.filter((violation) => production_files.has(violation.file()));
	}
}
