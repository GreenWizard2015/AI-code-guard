import type { CallableSourceImportScopeContract } from "src/analysis_protocols";
import { CallableSourceAnalysis } from "src/callable_source_analysis";
import { TEST_PATH_SUFFIXES } from "src/constants";
import type { PythonCallableReferenceTargetMapperContract } from "src/contracts/protocols/lint_runtime_protocols";
import type { CallableSourceProjectAnalysisContract } from "src/contracts/types/callable_usage_types";
import type {
	CallableUsageAnalysisOptions,
	CallableUsageAnalysisState,
	CallableUsageCollectorState,
} from "src/contracts/types/composition_types";
import type { CallableOwnershipIndexes } from "src/contracts/types/composition_types";
import { CallableMethodCounts } from "src/linting/orchestration/runtime/global-analysis/callable-usage/indexing/callable_method_counts";
import { CallableUsageIndex } from "src/linting/orchestration/runtime/global-analysis/callable-usage/indexing/callable_usage_index";
import { CallableOwnership } from "src/linting/orchestration/runtime/global-analysis/callable-usage/ownership/callable_ownership";
import { CallableSourceImportScope } from "src/linting/orchestration/runtime/global-analysis/callable-usage/ownership/callable_source_import_scope";
import { PythonCallableReferenceTargetMapper } from "src/linting/orchestration/runtime/global-analysis/callable-usage/reference-matching/python_callable_reference_target_mapper";
import { CallableSourceProjectAnalysis } from "src/linting/orchestration/runtime/global-analysis/callable-usage/usage-policy/callable_source_project_analysis";
import { CallableViolationCollector } from "src/linting/orchestration/runtime/global-analysis/callable-usage/usage-policy/callable_violation_collector";
import type { CallableDefinition, ParsedFile } from "src/metrics/types";
import type { AstClassNode } from "src/model/ast/normalized_ast_types";
import type { NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { CallableMethodCountsContract, TestPathSyntaxContract } from "src/shared_services_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { LintSourceRecordData } from "src/source_types";
import { TestPathSyntax } from "src/test_path_syntax";
import { TestPathKind } from "src/types";

/** Responsibilities: _callable usage analysis_, _timed state collection_. **/
export class CallableUsage {
	private readonly _sources: readonly LintSourceRecordData[];
	private readonly _python_reference_mapper: PythonCallableReferenceTargetMapperContract;
	private readonly _source_import_scope: CallableSourceImportScopeContract;
	private readonly _test_path_syntax: TestPathSyntaxContract;
	private readonly _stage_timer: LintStageTimerContract;

	/** Responsibilities: _method count aggregation_. **/
	private method_counts_for(definitions: readonly CallableDefinition[]): CallableMethodCountsContract {
		const counts = new CallableMethodCounts();
		for (const definition of definitions) {
			counts.append(definition);
		}
		return counts;
	}

	/** Responsibilities: _callable ownership lookup indexes_. **/
	private ownership_indexes(parsed_files: readonly ParsedFile[]): CallableOwnershipIndexes {
		const by_file = new Map<string, ParsedFile>();
		const by_absolute_file = new Map<string, ParsedFile>();
		const classes_by_file = new Map<string, ReadonlyMap<string, AstClassNode>>();
		for (const file of parsed_files) {
			by_file.set(file.file, file);
			by_absolute_file.set(file.absolute_file, file);
			const source_analysis = new CallableSourceAnalysis(file);
			classes_by_file.set(file.file, source_analysis.class_index());
		}
		return { by_file, by_absolute_file, classes_by_file };
	}

	/** Responsibilities: _callable analysis state construction_. **/
	private collect_analysis_state(
		production_files: readonly ParsedFile[],
		test_files: readonly ParsedFile[],
		definitions: readonly CallableDefinition[],
	): CallableUsageAnalysisState {
		const ownership = new CallableOwnership(production_files, this.ownership_indexes(production_files));
		const index = new CallableUsageIndex();
		index.append_files(production_files, test_files);
		const indexed = index.state(definitions);
		return {
			...indexed,
			external_methods: ownership.external_methods(definitions),
			ownership: ownership.ownership_resolver(indexed.project_types, indexed.class_nodes),
		};
	}

	/** Responsibilities: _callable usage state assembly_. **/
	private collector_state(
		production_files: ParsedFile[],
		definitions: CallableDefinition[],
		analysis: CallableUsageAnalysisState,
	): CallableUsageCollectorState {
		return {
			production_files,
			definitions,
			method_counts: this.method_counts_for(definitions),
			project_types: analysis.project_types,
			class_nodes: analysis.class_nodes,
			reference_index: analysis.reference_index,
			references_by_file: analysis.references_by_file,
			matcher_indexes: analysis.matcher_indexes,
			external_methods: analysis.external_methods,
			ownership: analysis.ownership,
		};
	}

	/** Responsibilities: _Python callable reference normalization_. **/
	private source_ast(source: LintSourceRecordData): NormalizedAstFile {
		if (source.language === "python") {
			return this._stage_timer.measure("global-analysis.callable-usage.python-reference-targets", () =>
				this._python_reference_mapper.map_source(source),
			);
		}
		return source.normalized_ast;
	}

	/** Responsibilities: _parsed callable source records_. **/
	private parsed_files(): ParsedFile[] {
		return this._stage_timer.measure("global-analysis.callable-usage.parsed-files", () =>
			this._sources.map((source) => {
				const ast = this.source_ast(source);
				return {
					file: source.relative_path,
					absolute_file: source.absolute_path,
					imports: this._source_import_scope.imports_for(source.absolute_path),
					ast,
					reference_aliases: ast.references.reference_aliases,
				};
			}),
		);
	}

	/** Responsibilities: _callable usage project initialization_. **/
	public constructor(options: CallableUsageAnalysisOptions) {
		this._sources = options.sources;
		this._source_import_scope = new CallableSourceImportScope(options.project_files, options.project_source_scanner);
		this._python_reference_mapper = new PythonCallableReferenceTargetMapper(
			options.project_root,
			options.import_context,
			options.source_asts,
		);
		this._test_path_syntax = new TestPathSyntax(TEST_PATH_SUFFIXES);
		this._stage_timer = options.stage_timer;
	}

	/** Responsibilities: _callable usage state construction_. **/
	public collect_state(): CallableUsageCollectorState {
		const parsed_files = this.parsed_files();
		const test_files = parsed_files.filter((file) =>
			this._test_path_syntax.classify(file.file).has(TestPathKind.TestFile),
		);
		const production_files = parsed_files.filter(
			(file) => !this._test_path_syntax.classify(file.file).has(TestPathKind.TestFile),
		);
		const source_analysis: CallableSourceProjectAnalysisContract = new CallableSourceProjectAnalysis(
			production_files,
			this._source_import_scope,
		);
		const classified_production_files = this._stage_timer.measure("global-analysis.callable-usage.external-bases", () =>
			source_analysis.mark_external_bases(),
		);
		const definitions = this._stage_timer.measure("global-analysis.callable-usage.definitions", () =>
			source_analysis.callable_definitions(),
		);
		const analysis = this._stage_timer.measure("global-analysis.callable-usage.indexes", () =>
			this.collect_analysis_state(classified_production_files, test_files, definitions),
		);
		return this.collector_state(classified_production_files, definitions, analysis);
	}

	/** Responsibilities: _collection timed callable usage_. **/
	public collect_timed_usage(): ViolationContract[] {
		const state = this._stage_timer.measure("global-analysis.callable-usage.state", () => this.collect_state());
		const collector = new CallableViolationCollector(state);
		return this._stage_timer.measure("global-analysis.callable-usage.violation-collection", () =>
			collector.collect_all(),
		);
	}
}
