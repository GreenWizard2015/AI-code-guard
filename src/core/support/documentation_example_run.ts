import { resolve } from "node:path";
import type { DocumentationExampleSourceFiles } from "documentation_validation/types";
import type { DocumentationExampleLintConfigurationContract } from "src/core/support/protocols";
import type { DocumentationExampleRunOptions } from "src/core/support/protocols";
import { LintReportMode } from "src/core/types";
import { LintStageTimer } from "src/lint_stage_timer";
import type { ViolationContract } from "src/reporting_protocols";
import { PROJECT_ANALYSIS_RULE_IDS } from "src/rules/catalog/modules/constants";
import type { LintExecutionReport } from "src/runtime_types";

/** Responsibilities: _documentation example inputs_, _virtual project diagnostics_. **/
export class DocumentationExampleRun {
	private readonly _repo_root: string;
	private readonly _source_path: string;
	private readonly _rule_id: string;
	private readonly _source_files: DocumentationExampleSourceFiles;
	private readonly _absolute_files: readonly string[];
	private readonly _configuration: DocumentationExampleLintConfigurationContract;

	/** Responsibilities: _example source text mapping_. **/
	private source_texts(): Map<string, string> {
		const texts = new Map<string, string>();
		for (const [index, source_file] of this._source_files.entries()) {
			const path = this._absolute_files[index];
			if (path === undefined) {
				throw new Error("Documentation source path mapping is incomplete.");
			}
			texts.set(path, source_file.text);
		}
		return texts;
	}

	/** Responsibilities: _virtual project execution_. **/
	private execute_example(source_texts: ReadonlyMap<string, string>): LintExecutionReport {
		const inputs = {
			files: [...this._absolute_files],
			project_files: [...this._absolute_files],
			ignored_files: [],
			markdown_files: [],
			ignore_files: [],
		};
		return this._configuration.lint_report(
			{
				repo_root: this._repo_root,
				ignored_directories: [],
				stage_timer: new LintStageTimer(),
				inputs,
				source_texts,
				configuration_snapshot_complete: true,
				entry_files: [],
				project_analysis_enabled: PROJECT_ANALYSIS_RULE_IDS.has(this._rule_id),
			},
			LintReportMode.IN_MEMORY_PROJECT,
		);
	}

	/** Responsibilities: _example source ownership_. **/
	public constructor(options: DocumentationExampleRunOptions) {
		this._repo_root = options.repo_root;
		this._source_path = options.source_path;
		this._rule_id = options.rule_id;
		this._source_files = options.source_files;
		this._absolute_files = options.source_files.map((source_file) => resolve(options.repo_root, source_file.path));
		this._configuration = options.configuration;
	}

	/** Responsibilities: _example source path validation_. **/
	public validate_paths(): void {
		const absolute_source_path = resolve(this._repo_root, this._source_path);
		if (!this._absolute_files.includes(absolute_source_path)) {
			throw new Error(`Documentation example source was not discovered: ${this._source_path}`);
		}
		const unique_files = new Set(this._absolute_files);
		if (unique_files.size !== this._absolute_files.length) {
			throw new Error("Documentation example contains duplicate source paths.");
		}
	}

	/** Responsibilities: _example rule diagnostics_. **/
	public violations(): readonly ViolationContract[] {
		const source_texts = this.source_texts();
		const execution = this.execute_example(source_texts);
		return execution.report.violations;
	}
}
