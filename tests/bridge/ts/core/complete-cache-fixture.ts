import { dirname, join, resolve } from "node:path";
import type { LintExecutionCacheContextOptions } from "src/core/cache/types";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import type { LintInputFiles } from "src/project_analysis_types";
import type { CliOptions } from "src/task_types";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

/** Responsibilities: _virtual cache inputs_, _shared project IO snapshots_. **/
export class CompleteCacheFixture {
	public readonly root = "/virtual/complete-cache-project";
	public readonly analyzer_root = "/virtual/complete-cache-analyzer";
	public readonly file: string;
	public readonly markdown_file: string;
	public readonly ignore_file: string;
	public readonly typescript_config_file: string;
	public readonly inputs: LintInputFiles;
	public readonly options: CliOptions;
	public readonly file_io: InMemoryFileIO;
	public readonly source_texts: Map<string, string>;
	public readonly source_io: InMemoryProjectSourceIO;
	public readonly analysis_identity: ProjectAnalysisIdentity;
	public readonly initial_source = "export const value = 1;\n";
	public readonly changed_source = "export const value = 2;\n";
	public readonly initial_markdown_source = "\u041f\u0440\u0438\u0432\u0435\u0442\n";
	public readonly changed_markdown_source = "Hello\n";

	/** Responsibilities: _complete project snapshot_. **/
	public constructor() {
		this.file = join(this.root, "module.ts");
		this.markdown_file = join(this.root, "notes.txt");
		this.ignore_file = join(this.root, ".gitignore");
		this.typescript_config_file = join(this.root, "tsconfig.json");
		this.source_texts = new Map([
			[this.file, this.initial_source],
			[this.markdown_file, this.initial_markdown_source],
			[this.ignore_file, "coverage/\n"],
			[this.typescript_config_file, '{"compilerOptions":{"baseUrl":"."}}\n'],
		]);
		const analyzer_files = new Map<string, string>([
			[join(this.analyzer_root, "src/analyzer.ts"), "export const analyzer = 1;\n"],
			[join(this.analyzer_root, "docs/rules/example.md"), "Rule.\n"],
			[join(this.analyzer_root, "test-runner/runner.ts"), "export const runner = true;\n"],
			[join(this.analyzer_root, "package.json"), "{}\n"],
			[join(this.analyzer_root, "requirements.txt"), "\n"],
			[join(this.analyzer_root, "tsconfig.json"), "{}\n"],
		]);
		this.file_io = new InMemoryFileIO();
		const file_io = this.file_io;
		file_io.seed_files(new Map([...this.source_texts, ...analyzer_files]));
		this.source_io = new InMemoryProjectSourceIO(this.source_texts);
		this.analysis_identity = new ProjectAnalysisIdentity(this.file_io, this.analyzer_root);
		this.inputs = {
			files: [this.file],
			project_files: [this.file],
			ignored_files: [],
			markdown_files: [this.markdown_file],
			ignore_files: [this.ignore_file],
		};
		this.options = {
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
		this.file_io.directory_operations.create_directory(dirname(absolute_file));
		this.file_io.file_content.write_text(absolute_file, text);
		this.source_texts.set(absolute_file, text);
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
			inputs: this.inputs,
			options: this.options,
			source_texts,
			analysis_identity,
			file_io: this.file_io,
			source_io: this.source_io,
		};
	}
}
