import { extname, resolve } from "node:path";
import { IGNORED_DIRS, PYTHON_PROJECT_CONFIGURATION_FILE } from "src/constants";
import { PYTHON_AST_STAGE_PREFIX } from "src/core/constants";
import { ContextSourceRecordSet } from "src/core/context/context_source_record_set";
import { PythonSourceFiles } from "src/core/context/python_source_files";
import { TypeScriptSourceFiles } from "src/core/context/type_script_source_files";
import { LintProjectContextStore } from "src/core/lint_project_context_store";
import type {
	ProjectContextAssemblyOptions,
	ProjectTextSnapshotOptions,
	PythonSourceBatchPreparation,
} from "src/core/types";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { TypeScriptProjectResolution } from "src/module-resolution/type_script_project_resolution";
import type { IOContract } from "src/io/protocols";
import type { PythonAstDataContract, PythonSourceFilesContract } from "src/python_protocols";
import type { ProjectAnalysisIdentityContract } from "src/runtime_protocols";
import type { LintProjectContextContract, LintStageTimerContract } from "src/shared_services_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type { LintSourceRecord } from "src/source_types";
import type { NormalizedAstFileContract, PythonSourceAstBatch } from "src/types";
import type ts from "typescript";

/** Responsibilities: _source language preparation_, _AST integration_, _project context assembly_. **/
export class LintProjectContextCreator {
	private readonly source_record_factory: ContextSourceRecordSet;
	private readonly source_io: ProjectSourceIOContract;
	private readonly python_ast_parser: PythonAstDataContract;
	private readonly file_io: IOContract;

	/** Responsibilities: _TypeScript source parsing_. **/
	private timed_source_files(
		files: string[],
		texts: ReadonlyMap<string, string>,
		stage_timer: LintStageTimerContract,
	): Map<string, ts.SourceFile> {
		return stage_timer.measure("startup.project-context.typescript-source-files", () => {
			const source_files = new TypeScriptSourceFiles(files, texts);
			return source_files.source_files();
		});
	}

	/** Responsibilities: _Python source batch_. **/
	private python_source_batch(
		files: string[],
		texts: ReadonlyMap<string, string>,
		repo_root: string,
		stage_timer: LintStageTimerContract,
		virtual_project: boolean,
	): PythonSourceBatchPreparation {
		let source_root = repo_root;
		if (virtual_project) {
			source_root = "";
		}
		const source_files = new PythonSourceFiles(files, texts, this.python_ast_parser, source_root);
		const batch = stage_timer.measure(PYTHON_AST_STAGE_PREFIX, () =>
			source_files.begin_source_ast(stage_timer, PYTHON_AST_STAGE_PREFIX),
		);
		return { source_files, batch };
	}

	/** Responsibilities: _Python AST completion_. **/
	private python_file_asts(
		source_files: PythonSourceFilesContract,
		batch: PythonSourceAstBatch,
		stage_timer: LintStageTimerContract,
	): ReadonlyMap<string, NormalizedAstFileContract> {
		if (batch.batch_id.length > 0) {
			return stage_timer.measure(PYTHON_AST_STAGE_PREFIX, () => source_files.complete_source_ast(batch));
		}
		return stage_timer.measure(PYTHON_AST_STAGE_PREFIX, () =>
			source_files.source_ast(stage_timer, PYTHON_AST_STAGE_PREFIX),
		);
	}

	/** Responsibilities: _language source records_. **/
	private language_records(
		options: ProjectContextAssemblyOptions,
		files: string[],
		python_file_asts: ReadonlyMap<string, NormalizedAstFileContract>,
	): LintSourceRecord[] {
		return this.source_record_factory.source_records({
			repo_root: options.repo_root,
			project_files: options.files,
			files,
			texts: options.texts,
			source_files: options.source_files,
			python_file_asts,
			stage_timer: options.stage_timer,
			virtual_project: options.virtual_project,
			source_io: options.source_io,
		});
	}

	/** Responsibilities: _original source-record order restoration_. **/
	private ordered_source_records(files: readonly string[], records: readonly LintSourceRecord[]): LintSourceRecord[] {
		const records_by_file = new Map(records.map((record) => [record.absolute_path, record]));
		return files.map((file) => {
			const record = records_by_file.get(file);
			if (record === undefined) {
				throw new Error(`Source record is missing for ${file}.`);
			}
			return record;
		});
	}

	/** Responsibilities: _overlapped language source-record assembly_. **/
	private project_source_records(options: ProjectContextAssemblyOptions): LintSourceRecord[] {
		const typescript_files = options.files.filter((file) => options.source_files.has(file));
		const python_files = options.files.filter((file) => !options.source_files.has(file));
		const typescript_records = this.language_records(options, typescript_files, new Map());
		const python_file_asts = this.python_file_asts(
			options.python_batch.source_files,
			options.python_batch.batch,
			options.stage_timer,
		);
		const python_records = this.language_records(options, python_files, python_file_asts);
		return this.ordered_source_records(options.files, [...typescript_records, ...python_records]);
	}

	/** Responsibilities: _project context assembly_. **/
	private project_context(
		options: ProjectContextAssemblyOptions,
		source_io: ProjectSourceIOContract,
	): LintProjectContextContract {
		const { files, source_files, stage_timer } = options;
		const sources = stage_timer.measure("startup.project-context.source-records", () =>
			this.project_source_records(options),
		);
		const statistics = this.source_record_factory.statistics(files, source_files);
		return stage_timer.measure(
			"startup.project-context.context-store",
			() => new LintProjectContextStore(sources, statistics, source_io),
		);
	}

	/** Responsibilities: _complete project text snapshot_. **/
	private project_texts(options: ProjectTextSnapshotOptions): Map<string, string> {
		const { repo_root, files, provided_texts, stage_timer, virtual_project, source_io } = options;
		return stage_timer.measure("startup.project-context.read-files", () => {
			const complete_texts = new Map(provided_texts);
			const resolution = new TypeScriptProjectResolution(repo_root, source_io);
		const configuration_files = [...resolution.configuration_files(), resolve(repo_root, PYTHON_PROJECT_CONFIGURATION_FILE)];
			for (const config_file of configuration_files) {
				if (complete_texts.has(config_file) || !source_io.source_available(config_file)) {
					continue;
				}
				complete_texts.set(config_file, source_io.source_text(config_file));
			}
			for (const file of files) {
				if (complete_texts.has(file)) {
					continue;
				}
				if (virtual_project && provided_texts.size > 0) {
					throw new Error(`Virtual source snapshot is incomplete: ${file}`);
				}
				complete_texts.set(file, source_io.source_text(file));
			}
			for (const path of this.runtime_source_paths(repo_root, complete_texts, provided_texts, virtual_project)) {
				complete_texts.set(path, source_io.source_text(path));
			}
			return complete_texts;
		});
	}

	/** Responsibilities: _runtime source paths_. **/
	private runtime_source_paths(
		repo_root: string,
		complete_texts: Map<string, string>,
		provided_texts: ReadonlyMap<string, string>,
		virtual_project: boolean,
	): string[] {
		if (!this.runtime_search(repo_root, provided_texts, virtual_project)) {
			return [];
		}
		const paths: string[] = [];
		for (const path of this.source_io.source_paths(repo_root, IGNORED_DIRS)) {
			if (complete_texts.has(path)) {
				continue;
			}
			if (![".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts", ".json"].includes(extname(path))) {
				continue;
			}
			paths.push(path);
		}
		return paths;
	}

	/** Responsibilities: _runtime source search_. **/
	private runtime_search(
		repo_root: string,
		provided_texts: ReadonlyMap<string, string>,
		virtual_project: boolean,
	): boolean {
		if (virtual_project) {
			return false;
		}
		if (provided_texts.size === 0) {
			return true;
		}
		return this.file_io.directory_entries.path_is_directory(repo_root);
	}

	/** Responsibilities: _Python AST data ownership_, _project source identity_. **/
	public constructor(
		parser: PythonAstDataContract,
		analysis_identity: ProjectAnalysisIdentityContract,
		source_io: ProjectSourceIOContract,
		file_io: IOContract,
	) {
		this.source_record_factory = new ContextSourceRecordSet(analysis_identity, file_io);
		this.source_io = source_io;
		this.python_ast_parser = parser;
		this.file_io = file_io;
	}

	/** Responsibilities: _construction complete project context_. **/
	public lint_context(
		repo_root: string,
		files: string[],
		stage_timer: LintStageTimerContract,
		provided_texts: ReadonlyMap<string, string>,
		virtual_project = false,
	): LintProjectContextContract {
		let read_source_io = this.source_io;
		if (virtual_project && provided_texts.size > 0) {
			read_source_io = new InMemoryProjectSourceIO(provided_texts);
		}
		const texts = this.project_texts({
			repo_root,
			files,
			provided_texts,
			stage_timer,
			virtual_project,
			source_io: read_source_io,
		});
		const source_io = new InMemoryProjectSourceIO(texts);
		const python_batch = this.python_source_batch(files, texts, repo_root, stage_timer, virtual_project);
		const source_files = this.timed_source_files(files, texts, stage_timer);
		return this.project_context(
			{ repo_root, files, texts, source_files, python_batch, stage_timer, virtual_project, source_io },
			source_io,
		);
	}

	/** Responsibilities: _source text configuration_. **/
	public source_texts(files: string[]): Map<string, string> {
		const texts = new Map<string, string>();
		for (const file of files) {
			texts.set(file, this.source_io.source_text(file));
		}
		return texts;
	}
}
