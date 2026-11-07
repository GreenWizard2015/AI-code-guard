import { resolve } from "node:path";
import type { LintRunConfiguration } from "src/core/lint_run_configuration";
import type { LintReportOptions } from "src/core/types";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { LintStageTimer } from "src/lint_stage_timer";
import type { ProjectSourceIOContract } from "src/source_protocols";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

/** Responsibilities: _virtual lint source inventory_, _in-memory report options_. **/
export class InMemoryLintProject {
	public readonly root = "/virtual/lint-run-project";
	public readonly _source_texts: ReadonlyMap<string, string>;
	public readonly _source_io: ProjectSourceIOContract;
	public readonly _file_io: InMemoryFileIO;

	/** Responsibilities: _virtual source snapshot construction_. **/
	public constructor(files: Record<string, string>) {
		const absolute_sources = new Map(Object.entries(files).map(([file, text]) => [resolve(this.root, file), text]));
		this._source_texts = absolute_sources;
		this._source_io = new InMemoryProjectSourceIO(absolute_sources);
		this._file_io = new InMemoryFileIO();
		this._file_io.seed_files(absolute_sources);
	}

	/** Responsibilities: _lint request preparation_. **/
	public options(
		configuration: LintRunConfiguration,
		ignored_directories: readonly string[] = [],
		entry_files: readonly string[] = [],
	): LintReportOptions {
		const inputs = configuration.input_files(this.root, ignored_directories);
		return {
			repo_root: this.root,
			ignored_directories,
			stage_timer: new LintStageTimer(),
			inputs,
			source_texts: this._source_texts,
			configuration_snapshot_complete: false,
			entry_files,
		};
	}
}
