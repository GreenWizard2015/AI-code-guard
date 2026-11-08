import { resolve } from "node:path";
import type { LintReportOptions } from "src/core/types";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { LintStageTimer } from "src/lint_stage_timer";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

/** Responsibilities: _snapshot input preparation_, _cache state observation_. **/
export class GlobalAnalysisSnapshotScenario {
	private readonly _root: string;
	private readonly _plugin_file: string;
	private readonly _configuration_file: string;
	private readonly _plugin_text: string;
	private readonly _configuration_a: string;
	private readonly _configuration_b: string;
	private readonly _source_texts: Map<string, string>;
	private readonly _source_io: InMemoryProjectSourceIO;
	private readonly _cache_io: InMemoryFileIO;

	/** Responsibilities: _snapshot scenario initialization_. **/
	public constructor() {
		this._root = "/virtual/global-analysis-snapshot";
		this._plugin_file = resolve(this._root, "tools/webmcp_project/plugin.py");
		this._configuration_file = resolve(this._root, "pyproject.toml");
		this._plugin_text = "class SamplePlugin:\n    pass\n";
		this._configuration_a = [
			'[project.entry-points."example.plugins"]',
			'sample = "webmcp_project.plugin:SamplePlugin"',
		].join("\n");
		this._configuration_b = '[project]\nname = "snapshot-project"\n';
		this._source_texts = new Map([
			[this._plugin_file, this._plugin_text],
			[this._configuration_file, this._configuration_a],
		]);
		this._source_io = new InMemoryProjectSourceIO(this._source_texts);
		this._cache_io = new InMemoryFileIO();
	}

	/** Responsibilities: _source snapshot access_. **/
	public source_io(): InMemoryProjectSourceIO {
		return this._source_io;
	}

	/** Responsibilities: _cache storage access_. **/
	public cache_io(): InMemoryFileIO {
		return this._cache_io;
	}

	/** Responsibilities: _initial source snapshot seeding_. **/
	public seed_initial_snapshot(): void {
		this._cache_io.seed_files(this._source_texts);
	}

	/** Responsibilities: _cached source snapshot update_. **/
	public update_cached_configuration(): void {
		this._source_texts.set(this._configuration_file, this._configuration_b);
		this._cache_io.seed_files(this._source_texts);
	}

	/** Responsibilities: _first configuration text_. **/
	public configuration_a(): string {
		return this._configuration_a;
	}

	/** Responsibilities: _second configuration text_. **/
	public configuration_b(): string {
		return this._configuration_b;
	}

	/** Responsibilities: _snapshot report input_. **/
	public report_options(project_configuration: string): LintReportOptions {
		const source_texts = new Map([
			[this._plugin_file, this._plugin_text],
			[this._configuration_file, project_configuration],
		]);
		return {
			repo_root: this._root,
			ignored_directories: [],
			stage_timer: new LintStageTimer(),
			inputs: {
				files: [this._plugin_file],
				project_files: [this._plugin_file],
				ignored_files: [],
				markdown_files: [],
				ignore_files: [],
			},
			source_texts,
			configuration_snapshot_complete: false,
			entry_files: [],
			project_analysis_enabled: false,
		};
	}
}
