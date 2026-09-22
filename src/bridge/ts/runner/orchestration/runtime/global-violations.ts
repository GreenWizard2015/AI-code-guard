import { CallableUsage } from 'src/bridge/ts/runner/orchestration/runtime/composition/callable-usage';
import { ClassRules } from 'src/bridge/ts/rules/class-rules';
import { Composition } from 'src/bridge/ts/runner/orchestration/runtime/composition/composition';
import { SharedParameterAdapter } from 'src/metrics/shared-parameter-adapter';
import { SharedParameterAnalyzer } from 'src/metrics/shared-parameter-analyzer';
import type { AnalyzedCallable } from 'src/metrics/types';
import { SharedParameterReporter } from 'src/metrics/shared-parameter-reporter';
import type { Violation } from 'src/protocols';
import type { LintProjectContext } from 'src/protocols';
import { ModulePlacementAnalyzer } from 'src/bridge/ts/runner/orchestration/runtime/module-placement';
import type { LintStageTimer } from 'src/bridge/ts/core/stage-timing';
import { TestFrameworkConsistency } from 'src/bridge/ts/runner/orchestration/runtime/python/test-framework-consistency';

/** Responsibilities: _execution project-wide class composition_. **/
export class GlobalViolationCollector {
	private readonly repo_root: string;

	private readonly project_files: string[];

	private readonly project_type_names: ReadonlySet<string>;

	private readonly context: LintProjectContext;

	private readonly ignored_files: ReadonlySet<string>;

	private readonly test_framework_consistency = new TestFrameworkConsistency();

	/** Responsibilities: _group analysis callables source_. **/
	private group_callables(callables: AnalyzedCallable[]): AnalyzedCallable[][] {
		const groups = new Map<string, AnalyzedCallable[]>();
		for (const callable of callables) {
			const language = callable.language;
			if (language === undefined) {
				continue;
			}
			let group = groups.get(language);
			if (group === undefined) {
				group = [];
				groups.set(language, group);
			}
			group.push(callable);
		}
		return [...groups.values()];
	}

	/** Responsibilities: _production callables group adaptation_. **/
	private callable_groups(): AnalyzedCallable[][] {
		const callables: AnalyzedCallable[] = [];
		const production_files = this.project_files.filter(file =>
			this.context.source_record(file).file_name.product()
		);
		for (const file of production_files) {
			const source = this.context.source_record(file);
			const adapter = new SharedParameterAdapter({
				file: source.relative_path,
				kind: 'function',
				nodes: source.normalized_ast.functions,
				project_types: this.project_type_names,
				reference_aliases: source.normalized_ast.reference_aliases,
				language: source.language,
			});
			callables.push(...adapter.callables());
		}
		return this.group_callables(callables);
	}

	/** Responsibilities: _collection reporting shared parameter_. **/
	private parameter_violations(): Violation[] {
		const candidates = this.callable_groups().flatMap(callable_group => {
			const analyzer = new SharedParameterAnalyzer(callable_group);
			return analyzer.collect_candidates();
		});
		const reporter = new SharedParameterReporter(candidates);
		return reporter.violations();
	}

	/** Responsibilities: _time collection project-wide class-field_. **/
	private class_fields_stage(stage_timer: LintStageTimer): Violation[] {
		const class_rules = new ClassRules();
		return stage_timer.measure(
			'global-analysis.class-fields',
			() => class_rules.collect_context_fields({
				files: this.project_files,
				repo_root: this.repo_root,
			}, this.context)
		);
	}

	/** Responsibilities: _time collection composition violations_. **/
	private composition_stage(stage_timer: LintStageTimer): Violation[] {
		const composition = new Composition();
		return stage_timer.measure(
			'global-analysis.composition',
			() => composition.collect_composition(this.context.files(), this.repo_root)
		);
	}

	/** Responsibilities: _time collection callable usage_. **/
	private callable_usage_stage(stage_timer: LintStageTimer): Violation[] {
		const callable_usage = new CallableUsage();
		return stage_timer.measure(
			'global-analysis.callable-usage',
			() => callable_usage.collect_timed_usage(this.context.files(), stage_timer)
		);
	}

	/** Responsibilities: _time shared-parameter analysis_. **/
	private parameters_stage(stage_timer: LintStageTimer): Violation[] {
		return stage_timer.measure(
			'global-analysis.shared-parameters',
			() => this.parameter_violations()
		);
	}

	/** Responsibilities: _time collection module-placement violations_. **/
	private module_placement_stage(stage_timer: LintStageTimer): Violation[] {
		const module_placement = new ModulePlacementAnalyzer(
			this.repo_root,
			this.project_files,
			this.context,
			this.ignored_files,
		);
		return stage_timer.measure(
			'global-analysis.module-placement',
			() => module_placement.collect_violations()
		);
	}

	/** Responsibilities: _time collection Python test-framework_. **/
	private test_framework_stage(stage_timer: LintStageTimer): Violation[] {
		return stage_timer.measure(
			'global-analysis.test-framework',
			() => this.test_framework_consistency.violations(this.context)
		);
	}

	/** Responsibilities: _initialization project inputs shared_. **/
	public constructor(
		repo_root: string,
		project_files: string[],
		project_type_names: ReadonlySet<string>,
		context: LintProjectContext,
		ignored_files: ReadonlySet<string>,
	) {
		this.repo_root = repo_root;
		this.project_files = project_files;
		this.project_type_names = project_type_names;
		this.context = context;
		this.ignored_files = ignored_files;
	}

	/** Responsibilities: _execution project-wide analysis stages_. **/
	public collect(stage_timer: LintStageTimer): Violation[] {
		return [
			...this.class_fields_stage(stage_timer),
			...this.composition_stage(stage_timer),
			...this.callable_usage_stage(stage_timer),
			...this.parameters_stage(stage_timer),
			...this.module_placement_stage(stage_timer),
			...this.test_framework_stage(stage_timer),
		];
	}

	/** Responsibilities: _collection project-wide violations retention_. **/
	public collect_for(target_files: ReadonlySet<string>, stage_timer: LintStageTimer): Violation[] {
		const violations = this.collect(stage_timer);
		if (target_files.size === 0) {
			return [];
		}
		return violations.filter(violation => target_files.has(violation.file));
	}
}
