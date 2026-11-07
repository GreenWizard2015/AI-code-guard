import { dirname, join, resolve } from "node:path";
import type { LintExecutionCacheContextOptions } from "src/core/cache/types";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import type { LintInputFiles } from "src/project_analysis_types";
import type { CliOptions } from "src/task_types";
import type { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

/** Responsibilities: _virtual cache inputs_, _shared project IOContract snapshots_. **/
export class CompleteCacheFixture {
	public readonly root = "/virtual/complete-cache-project";
	public readonly analyzer_root = "/virtual/complete-cache-analyzer";
	public readonly _file: string;
	public readonly _markdown_file: string;
	public readonly _ignore_file: string;
	public readonly _typescript_config_file: string;
	public readonly _python_config_file: string;
	public readonly _inputs: LintInputFiles;
	public readonly _options: CliOptions;
	public readonly _file_io: InMemoryFileIO;
	public readonly _source_texts: Map<string, string>;
	public readonly _temporary_write_paths: Set<string>;
	public readonly _source_io: InMemoryProjectSourceIO;
	public readonly _analysis_identity: ProjectAnalysisIdentity;
	public readonly initial_source = "export const value = 1;\n";
	public readonly changed_source = "export const value = 2;\n";
	public readonly initial_markdown_source = "\u041f\u0440\u0438\u0432\u0435\u0442\n";
	public readonly changed_markdown_source = "Hello\n";

	/** Responsibilities: _complete project snapshot_. **/
	public constructor(file_io: InMemoryFileIO) {
		this._file = join(this.root, "module.ts");
		this._markdown_file = join(this.root, "notes.txt");
		this._ignore_file = join(this.root, ".gitignore");
		this._typescript_config_file = join(this.root, "tsconfig.json");
		this._python_config_file = join(this.root, "pyproject.toml");
		this._source_texts = new Map([
			[this._file, this.initial_source],
			[this._markdown_file, this.initial_markdown_source],
			[this._ignore_file, "coverage/\n"],
			[this._typescript_config_file, '{"compilerOptions":{"baseUrl":"."}}\n'],
			[this._python_config_file, '[project]\nname = "cache-fixture"\n'],
		]);
		const analyzer_files = new Map<string, string>([
			[join(this.analyzer_root, "src/analyzer.ts"), "export const analyzer = 1;\n"],
			[join(this.analyzer_root, "docs/rules/example.md"), "Rule.\n"],
			[join(this.analyzer_root, "test-runner/runner.ts"), "export const runner = true;\n"],
			[join(this.analyzer_root, "package.json"), "{}\n"],
			[join(this.analyzer_root, "requirements.txt"), "\n"],
			[join(this.analyzer_root, "tsconfig.json"), "{}\n"],
		]);
		this._file_io = file_io;
		this._temporary_write_paths = new Set<string>();
		this._file_io.seed_files(new Map([...this._source_texts, ...analyzer_files]));
		this._source_io = new InMemoryProjectSourceIO(this._source_texts);
		this._analysis_identity = new ProjectAnalysisIdentity(this._file_io, this.analyzer_root);
		this._inputs = {
			files: [this._file],
			project_files: [this._file],
			ignored_files: [],
			markdown_files: [this._markdown_file],
			ignore_files: [this._ignore_file],
		};
		this._options = {
			ignored_directories: [],
			entry_files: [],
			root: this.root,
			skip_review: true,
			force_review: false,
			review_cleanup: false,
			review_agent: "none",
			review_stages: [],
			batch_size: 10,
			policy: "all",
		};
	}

	/** Responsibilities: _virtual source replacement_. **/
	public write_source(file: string, text: string): void {
		const absolute_file = resolve(file);
		this._file_io.create_directory(dirname(absolute_file));
		this._file_io.file(absolute_file).write_text(text);
		this._source_texts.set(absolute_file, text);
	}

	/** Responsibilities: _nested source fixture_. **/
	public create_nested_input(): string {
		const file = join(this.root, "new", "nested", "new.ts");
		this.write_source(file, "export const next = 2;\n");
		return file;
	}

	/** Responsibilities: _cache context dependency assembly_. **/
	public cache_context_options(
		source_texts: ReadonlyMap<string, string>,
		analysis_identity: ProjectAnalysisIdentity,
	): LintExecutionCacheContextOptions {
		return {
			root: this.root,
			inputs: this._inputs,
			options: this._options,
			source_texts,
			analysis_identity,
			file_io: this._file_io,
			temporary_write_paths: this._temporary_write_paths,
			source_io: this._source_io,
			source_snapshot_complete: true,
		};
	}
}
