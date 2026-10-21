import { CallableMethodCounts } from "src/linting/orchestration/runtime/global-analysis/callable-usage/callable_method_counts";
import { CallableUsageDefinitionPolicy } from "src/linting/orchestration/runtime/global-analysis/callable-usage/callable_usage_definition_policy";
import { CallableViolationCollector } from "src/linting/orchestration/runtime/global-analysis/callable-usage/callable_violation_collector";
import { PythonCallableReferenceTargetMapper } from "src/linting/orchestration/runtime/global-analysis/callable-usage/python_callable_reference_target_mapper";
import type {
	CallableUsageCollectorStateContract,
	CallableUsageAnalysisState,
} from "src/linting/orchestration/runtime/composition/types";
import type {
	CallableDefinition,
	ParsedFile,
} from "src/metrics/types";
import type { CallableMethodCountsContract } from "src/shared_services_protocols";
import type { CallableSourceImportScopeContract } from "src/analysis_protocols";
import type { ProjectSourceScannerContract } from "src/source_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { PythonCallableReferenceTargetMapperContract } from "src/linting/orchestration/runtime/protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { LintSourceRecord, PythonProjectImportContext } from "src/source_types";
import type { NormalizedAstFileContract } from "src/types";
import { TestPathSyntax } from "src/test_path_syntax";
import { CallableSourceImportScope } from "src/linting/orchestration/runtime/global-analysis/callable-usage/callable_source_import_scope";
import { CallableOwnership } from "src/linting/orchestration/runtime/global-analysis/callable-usage/callable_ownership";
import { CallableUsageIndex } from "src/linting/orchestration/runtime/global-analysis/callable-usage/callable_usage_index";

/** Responsibilities: _callable usage analysis_, _timed state collection_. **/
export class CallableUsage {
	private readonly python_reference_mapper: PythonCallableReferenceTargetMapperContract;
	private readonly source_import_scope: CallableSourceImportScopeContract;
	private readonly definition_policy: CallableUsageDefinitionPolicy;
	private readonly callable_ownership: CallableOwnership;
	private readonly test_path_syntax: TestPathSyntax;

	/** Responsibilities: _source AST preparation_. **/
	private parsed_ast(source: LintSourceRecord, stage_timer: LintStageTimerContract): NormalizedAstFileContract {
		if (source.language === "python") {
			return stage_timer.measure("global-analysis.callable-usage.python-reference-targets", () =>
				this.python_reference_mapper.map_source(source),
			);
		}
		return source.normalized_ast;
	}

	/** Responsibilities: _source record preparation_. **/
	private parsed_sources(sources: readonly LintSourceRecord[], stage_timer: LintStageTimerContract): ParsedFile[] {
		return stage_timer.measure("global-analysis.callable-usage.parsed-files", () =>
			sources.map((source) => ({
				file: source.relative_path,
				absolute_file: source.absolute_path,
				imports: this.source_import_scope.imports_for(source.absolute_path),
				ast: this.parsed_ast(source, stage_timer),
			})),
		);
	}

	/** Responsibilities: _production callable definitions collection_. **/
	private callable_definitions_for(
		production_files: ParsedFile[],
		stage_timer: LintStageTimerContract,
	): CallableDefinition[] {
		return stage_timer.measure("global-analysis.callable-usage.definitions", () =>
			production_files
				.flatMap((file) => this.definition_policy.callable_definitions(file))
				.filter((definition) => this.definition_policy.callable_definition(definition)),
		);
	}

	/** Responsibilities: _production source filtering_, _external base classification_. **/
	/** Responsibilities: _callable method count_. **/
	private method_counts_for(definitions: readonly CallableDefinition[]): CallableMethodCountsContract {
		const method_counts: CallableMethodCountsContract = new CallableMethodCounts();
		for (const definition of definitions) {
			method_counts.append(definition);
		}
		return method_counts;
	}

	/** Responsibilities: _callable analysis state construction_. **/
	private collect_analysis_state(
		production_files: readonly ParsedFile[],
		test_files: readonly ParsedFile[],
		definitions: readonly CallableDefinition[],
	): CallableUsageAnalysisState {
		const index = new CallableUsageIndex();
		for (const file of production_files) {
			index.append_file(file);
		}
		for (const file of test_files) {
			index.append_reference_file(file);
		}
		index.append_implementations(definitions);
		const indexed = index.state(definitions);
		return {
			...indexed,
			external_methods: this.callable_ownership.external_methods(definitions, [...production_files]),
			ownership: this.callable_ownership.ownership_resolver(
				[...production_files],
				indexed.project_types,
				indexed.class_nodes,
			),
		};
	}

	/** Responsibilities: _callable usage state assembly_. **/
	private collector_state(
		parsed_files: ParsedFile[],
		production_files: ParsedFile[],
		test_files: ParsedFile[],
		definitions: CallableDefinition[],
		analysis: CallableUsageAnalysisState,
	): CallableUsageCollectorStateContract {
		return {
			parsed_files,
			production_files,
			test_files,
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

	/** Responsibilities: _callable usage project initialization_. **/
	public constructor(
		project_root: string,
		project_files: readonly string[],
		import_context: PythonProjectImportContext,
		project_source_scanner: ProjectSourceScannerContract,
		source_asts: ReadonlyMap<string, NormalizedAstFileContract>,
	) {
		this.source_import_scope = new CallableSourceImportScope(project_files, project_source_scanner);
		this.definition_policy = new CallableUsageDefinitionPolicy(this.source_import_scope);
		this.python_reference_mapper = new PythonCallableReferenceTargetMapper(project_root, import_context, source_asts);
		this.callable_ownership = new CallableOwnership();
		this.test_path_syntax = new TestPathSyntax();
	}

	/** Responsibilities: _callable usage state construction_. **/
	public collect_state(
		sources: readonly LintSourceRecord[],
		stage_timer: LintStageTimerContract,
	): CallableUsageCollectorStateContract {
		const parsed_files = this.parsed_sources(sources, stage_timer);
		const test_files = parsed_files.filter((file) => this.test_path_syntax.test_file(file.file));
		const production_files = parsed_files.filter((file) => !this.test_path_syntax.test_file(file.file));
		const classified_production_files = stage_timer.measure(
			"global-analysis.callable-usage.external-bases",
			() => this.definition_policy.mark_external_bases(production_files),
		);
		const definitions = this.callable_definitions_for(classified_production_files, stage_timer);
		const analysis = stage_timer.measure("global-analysis.callable-usage.indexes", () =>
			this.collect_analysis_state(classified_production_files, test_files, definitions),
		);
		return this.collector_state(parsed_files, classified_production_files, test_files, definitions, analysis);
	}

	/** Responsibilities: _collection timed callable usage_. **/
	public collect_timed_usage(
		sources: readonly LintSourceRecord[],
		stage_timer: LintStageTimerContract,
	): ViolationContract[] {
		const state = stage_timer.measure("global-analysis.callable-usage.state", () =>
			this.collect_state(sources, stage_timer),
		);
		const collector = new CallableViolationCollector(state);
		return stage_timer.measure("global-analysis.callable-usage.violation-collection", () => collector.collect_all());
	}
}
