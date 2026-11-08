import { LintProjectContextCreator } from "src/core/lint_project_context_creator";
import { ProjectSourceScanner } from "src/core/project-source/project_source_scanner";
import { ProjectNameRegistry } from "src/core/support/project_name_registry";
import { LintReportMode, type LintReportOptions, type LintRunStateContextOptions } from "src/core/types";
import type {
	LintProjectContextRequest,
	LintRunInventory,
	LintRunState,
	ProjectNameContext,
	ProjectNames,
	ProjectSourceAnalysisOptions,
} from "src/project_analysis_types";
import type { LintProjectContextContract } from "src/shared_services_protocols";

/** Responsibilities: _lint report state_, _project analysis context_. **/
export class LintRunStateContext {
	private readonly _options: LintRunStateContextOptions;

	/** Responsibilities: _project input inventory_. **/
	private project_inventory(): LintRunInventory {
		const report = this._options.report;
		const project_files = report.stage_timer.measure("startup.project-file-discovery", () => {
			return report.inputs.project_files;
		});
		const ignored_directories = this._options.input_file_selector.ignored_directories(
			report.repo_root,
			report.ignored_directories,
		);
		return {
			files: report.inputs.files,
			entry_files: [...report.entry_files],
			ignored_files: new Set(report.inputs.ignored_files),
			ignored_directories,
			project_files,
			markdown_files: report.inputs.markdown_files,
		};
	}

	/** Responsibilities: _project symbol names_. **/
	private project_names(input: ProjectNameContext): ProjectNames {
		const report = this._options.report;
		return report.stage_timer.measure("startup.project-names", () => {
			const registry = new ProjectNameRegistry(input);
			return registry.names();
		});
	}

	/** Responsibilities: _project source analysis scope_. **/
	private project_scope(
		report: LintReportOptions,
		inventory: LintRunInventory,
		context: LintProjectContextContract,
	): ProjectSourceAnalysisOptions {
		return {
			root: report.repo_root,
			project_files: inventory.project_files,
			context,
			ignored_files: inventory.ignored_files,
			scanner: new ProjectSourceScanner(report.repo_root, {
				context_state: { available: true, value: context },
				entry_files: inventory.entry_files,
			}),
			files: new Set(inventory.project_files),
			file_io: this._options.file_io,
			directory_files: {
				virtual_project: this._options.mode === LintReportMode.IN_MEMORY_PROJECT,
				files: inventory.files,
			},
		};
	}

	/** Responsibilities: _state assembly dependency initialization_. **/
	public constructor(options: LintRunStateContextOptions) {
		this._options = options;
	}

	/** Responsibilities: _project context creation_. **/
	public project_context(project_files: string[]): LintProjectContextContract {
		const report = this._options.report;
		const request: LintProjectContextRequest = {
			repo_root: report.repo_root,
			project_files,
			ignore_files: report.inputs.ignore_files,
			stage_timer: report.stage_timer,
			source_texts: report.source_texts,
			in_memory: this._options.mode === LintReportMode.IN_MEMORY_PROJECT,
			configuration_snapshot_complete: report.configuration_snapshot_complete,
		};
		const creator = new LintProjectContextCreator(
			this._options.python_parser,
			this._options.analysis_identity,
			this._options.source_io,
			this._options.file_io,
		);
		return report.stage_timer.measure("startup.project-context", () => creator.lint_context(creator.snapshot(request)));
	}

	/** Responsibilities: _normalization lint state assembly_. **/
	public state(): LintRunState {
		const report: LintReportOptions = this._options.report;
		const inventory = this.project_inventory();
		const context = this.project_context(inventory.project_files);
		const project_names = this.project_names({
			repo_root: report.repo_root,
			project_files: inventory.project_files,
			context,
		});
		return {
			repo_root: report.repo_root,
			ignore_files: [...report.inputs.ignore_files],
			inventory,
			names: project_names,
			context,
			project_scope: this.project_scope(report, inventory, context),
			source_texts: report.source_texts,
			cache: {
				global_enabled: this._options.mode === LintReportMode.PROJECT,
				project_analysis_rules: report.project_analysis_enabled,
				virtual_project: this._options.mode === LintReportMode.IN_MEMORY_PROJECT,
			},
		};
	}
}
