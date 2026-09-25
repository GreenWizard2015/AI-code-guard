import { relative } from 'node:path';
import type { LintAnalysisStage, LintRunResult } from 'src/bridge/ts/runtime/types';
import { DirectoryRules } from 'src/bridge/ts/rules/support/directory-rules';
import { FileLinter } from 'src/bridge/ts/runner/orchestration/runtime/file-lint';
import { GlobalViolationCollector } from 'src/bridge/ts/runner/orchestration/runtime/global-violations';
import { MarkdownFileDiscovery } from 'src/bridge/ts/core/markdown-file-discovery';
import type { Violation } from 'src/protocols';

/** Responsibilities: _directory analysis coordination_, _file analysis coordination_, _global analysis coordination_. **/
export class LintRunAnalysis {
	private readonly directory_rules = new DirectoryRules();
	private readonly markdown_files = new MarkdownFileDiscovery();

	/** Responsibilities: _Markdown violations collection_. **/
	private collect_markdown(stage: LintAnalysisStage): Violation[] {
		return stage.stage_timer.measure(
			'markdown-analysis',
			() => this.markdown_files.violations(
				stage.state.repo_root,
				stage.state.ignored_directories,
			),
		);
	}

	/** Responsibilities: _directory-level violations collection_. **/
	public collect_directory(stage: LintAnalysisStage): Violation[] {
		const state = stage.state;
		const analyzed_files = state.files.filter(file => !state.ignored_files.has(file));
		const class_counts = new Map(
			analyzed_files.map(file => [file, state.context.source_record(file).normalized_ast.classes.length]),
		);
		const source_asts = new Map(
			analyzed_files.map(file => [file, state.context.source_record(file).normalized_ast]),
		);
		return this.directory_rules.collect_directory_violations(
			analyzed_files,
			state.repo_root,
			class_counts,
			source_asts,
		);
	}

	/** Responsibilities: _file-level violations collection_. **/
	public collect_file(stage: LintAnalysisStage): Violation[] {
		const state = stage.state;
		const file_linter = new FileLinter({
			project_class_names: state.project_class_names,
			project_protocol_names: state.project_protocol_names,
			project_type_names: state.project_type_names,
			project_contract_names: state.project_contract_names,
			context: state.context,
			ignored_files: state.ignored_files,
		});
		return file_linter.lint_files(state.files, stage.stage_timer);
	}

	/** Responsibilities: _global violations collection_. **/
	public collect_global(stage: LintAnalysisStage): Violation[] {
		const state = stage.state;
		const target_file_set = new Set(
			state.files.flatMap(file => [file, relative(state.repo_root, file)]),
		);
		const global_violation_collector = new GlobalViolationCollector(
			state.repo_root,
			state.project_files,
			state.project_type_names,
			state.context,
			state.ignored_files,
		);
		return global_violation_collector.collect_for(target_file_set, stage.stage_timer);
	}

	/** Responsibilities: _every analysis stage execution_, _combine violations_. **/
	public collect(stage: LintAnalysisStage): LintRunResult {
		const directory_violations = stage.stage_timer.measure('directory-analysis', () => this.collect_directory(stage));
		const file_violations = stage.stage_timer.measure('file-analysis', () => this.collect_file(stage));
		const global_violations = stage.stage_timer.measure('global-analysis', () => this.collect_global(stage));
		const markdown_violations = this.collect_markdown(stage);
		return {
			files: stage.state.files,
			violations: [...directory_violations, ...file_violations, ...global_violations, ...markdown_violations],
		};
	}
}
