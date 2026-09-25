import { LintProjectContextCreator } from 'src/bridge/ts/core/context-factory';
import { LintFileDiscovery } from 'src/bridge/ts/core/lint-file-discovery';
import { ProjectNameRegistry } from 'src/bridge/ts/core/support/project-names-factory';
import { resolve } from 'node:path';
import { relative } from 'node:path';
import { dirname } from 'node:path';
import type { LintProjectContext } from 'src/protocols';
import { LintRunAnalysis } from 'src/bridge/ts/core/lint-run-analysis';
import type { LintAnalysisStage, LintRunState } from 'src/bridge/ts/runtime/types';
import type { LintExecutionReport, ProjectNames } from 'src/bridge/ts/core/types';
import { LintStageTimer } from 'src/bridge/ts/core/stage-timing';
import { PythonAstData } from 'src/bridge/ts/core/python-ast-parser';
import { PythonAstWorker } from 'src/bridge/ts/core/python-ast-worker.mjs';
import { PythonAstBridge } from 'src/bridge/ts/core/python-ast-bridge';




/** Responsibilities: _discovery lint files construction_. **/
export class LintRunConfiguration {
	private readonly empty_ignored_directories = new Set<string>();
	private readonly project_names_factory = new ProjectNameRegistry();
	private readonly lint_run_analysis = new LintRunAnalysis();
	private readonly python_ast_bridge = new PythonAstBridge();
	public readonly python_ast_worker = new PythonAstWorker(
		this.python_ast_bridge.worker_arguments(),
		this.python_ast_bridge.worker_options(),
		true
	);
	private readonly python_ast_parser = new PythonAstData(this.python_ast_worker);

	/** Responsibilities: _combination configuration repository-default ignored_. **/
	private configured_ignored_directories(
		repo_root: string,
		configured: readonly string[]
	): ReadonlySet<string> {
		const values: string[] = [...configured];
		const paths: string[] = [];
		for (const value of values) {
			const trimmed = value.trim();
			if (trimmed.length > 0) {
				paths.push(resolve(repo_root, trimmed).replaceAll('\\', '/'));
			}
		}
		return new Set(paths);
	}

	/** Responsibilities: _project file discovery_. **/
	private list_project_files(
		repo_root: string,
		target_files: string[],
		configured: readonly string[]
	): string[] {
		const lint_file_discovery = new LintFileDiscovery();
		const ignored_directories = this.configured_ignored_directories(repo_root, configured);
		let repository_files: string[] = [];
		if (target_files.some(file => !relative(repo_root, file).startsWith('..'))) {
			repository_files = lint_file_discovery.walk_files_under(repo_root, repo_root, ignored_directories);
		}
		const directory_files = target_files
			.map(file => dirname(file))
			.filter(directory => relative(repo_root, directory).startsWith('..'))
			.flatMap(directory => lint_file_discovery.walk_files_under(repo_root, directory, ignored_directories));
		return Array.from(new Set([...repository_files, ...directory_files]));
	}

	/** Responsibilities: _resolution ignored files configuration_. **/
	private ignored_files(repo_root: string, directories: ReadonlySet<string>): ReadonlySet<string> {
		const lint_file_discovery = new LintFileDiscovery();

		return new Set(
			Array.from(directories).flatMap(directory =>
				lint_file_discovery.walk_files_under(repo_root, directory, this.empty_ignored_directories)
			)
		);
	}

	/** Responsibilities: _resolution configuration target files_. **/
	private discover_target_files(
		repo_root: string,
		configured: readonly string[],
		stage_timer: LintStageTimer
	): string[] {
		return stage_timer.measure(
			'startup.file-discovery',
			() => this.target_files(repo_root, configured)
		);
	}

	/** Responsibilities: _discovery source files target_. **/
	private discover_project_files(
		repo_root: string,
		files: string[],
		configured: readonly string[],
		stage_timer: LintStageTimer
	): string[] {
		return stage_timer.measure(
			'startup.project-file-discovery',
			() => this.list_project_files(repo_root, files, configured)
		);
	}

	/** Responsibilities: _creation shared project context_. **/
	private create_project_context(
		repo_root: string,
		project_files: string[],
		stage_timer: LintStageTimer
	): LintProjectContext {
		const context_factory = new LintProjectContextCreator(this.python_ast_parser);
		return stage_timer.measure(
			'startup.project-context',
			() => context_factory.lint_context(repo_root, project_files, stage_timer)
		);
	}

	/** Responsibilities: _discovery project type names_. **/
	private discover_project_names(
		repo_root: string,
		project_files: string[],
		context: LintProjectContext,
		stage_timer: LintStageTimer
	): ProjectNames {
		return stage_timer.measure(
			'startup.project-names',
			() => this.project_names_factory.names(repo_root, project_files, context)
		);
	}

	/** Responsibilities: _normalization lint state assembly_. **/
	private lint_state(
		repo_root: string,
		configured: readonly string[],
		stage_timer: LintStageTimer
	): LintRunState {
		const files = this.discover_target_files(repo_root, configured, stage_timer);
		const project_files = this.discover_project_files(repo_root, files, configured, stage_timer);
		const ignored_directories = this.configured_ignored_directories(repo_root, configured);
		const ignored_files_set = this.ignored_files(repo_root, ignored_directories);
		const context = this.create_project_context(repo_root, project_files, stage_timer);
		const project_names = this.discover_project_names(repo_root, project_files, context, stage_timer);
		return {
			repo_root,
			files,
			ignored_files: ignored_files_set,
			ignored_directories,
			project_files,
			...project_names,
			context,
		};
	}

	/** Responsibilities: _classification path belongs ignored_. **/
	private is_ignored_file(file: string, ignored_directories: ReadonlySet<string>): boolean {
		return Array.from(ignored_directories).some(directory => {
			const relative_file = relative(directory, file);
			return relative_file === '' || (!relative_file.startsWith('..') && !relative_file.startsWith('/'));
		});
	}

	/** Responsibilities: _exposure resolution target files_. **/
	public target_files(repo_root: string, configured: readonly string[]): string[] {
		const lint_file_discovery = new LintFileDiscovery();

		const ignored_directories = this.configured_ignored_directories(repo_root, configured);
		const explicit_files = lint_file_discovery.target_files_env(repo_root);
		if (explicit_files.length === 0) {
			return lint_file_discovery.walk_files_under(repo_root, repo_root, ignored_directories);
		}
		return explicit_files.filter(file => !this.is_ignored_file(file, ignored_directories));
	}

	/** Responsibilities: _creation complete lint reporting_. **/
	public lint_report(
		repo_root: string,
		ignored_directories: readonly string[],
		provided_timer: LintStageTimer
	): LintExecutionReport {
		const directories = ignored_directories;
		const stage_timer = provided_timer;
		const state = this.lint_state(repo_root, directories, stage_timer);
		const analysis_stage: LintAnalysisStage = { state, stage_timer };
		const result = this.lint_run_analysis.collect(analysis_stage);
		return { context: state.context, report: result };
	}
}
