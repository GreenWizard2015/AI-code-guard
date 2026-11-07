import { ContextSourceRecordSet } from "src/core/context/context_source_record_set";
import { LintProjectContextStore } from "src/core/lint_project_context_store";
import { ProjectSourcePreparation } from "src/core/project_source_preparation";
import { ProjectTextSnapshot } from "src/core/project_text_snapshot";
import type {
	LintProjectContextSnapshot,
	ProjectContextAssemblyOptions,
	ProjectContextSourcePreparationOptions,
	ProjectTextSnapshotOptions,
	SourceRecordCreationOptions,
} from "src/core/types";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import type { IOContract } from "src/io/protocols";
import type { NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import type { LintProjectContextRequest } from "src/project_analysis_types";
import type { PythonAstDataContract } from "src/python_protocols";
import type { ProjectAnalysisIdentityContract } from "src/runtime_protocols";
import type { LintProjectContextContract } from "src/shared_services_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type { LintSourceRecordData } from "src/source_types";
import type { ContextSourceRecordsOptions } from "src/source_types";

/** Responsibilities: _source language preparation_, _AST integration_, _project context assembly_. **/
export class LintProjectContextCreator {
	private readonly _source_record_factory: ContextSourceRecordSet;
	private readonly _source_io: ProjectSourceIOContract;
	private readonly _python_ast_parser: PythonAstDataContract;

	/** Responsibilities: _original source-record order restoration_. **/
	private ordered_source_records(
		files: readonly string[],
		records: readonly LintSourceRecordData[],
	): LintSourceRecordData[] {
		const records_by_file = new Map(records.map((record) => [record.absolute_path, record]));
		return files.map((file) => {
			const record = records_by_file.get(file);
			if (record === undefined) {
				throw new Error(`Source record is missing for ${file}.`);
			}
			return record;
		});
	}

	/** Responsibilities: _source record factory input_. **/
	private source_records(
		options: SourceRecordCreationOptions,
		selected_files: string[],
		python_file_asts: ReadonlyMap<string, NormalizedAstFile>,
	): LintSourceRecordData[] {
		const record_options: ContextSourceRecordsOptions = {
			repo_root: options.repo_root,
			project_files: options.files,
			files: selected_files,
			texts: options.texts,
			source_files: options.source_files,
			python_file_asts,
			stage_timer: options.stage_timer,
			virtual_project: options.virtual_project,
			source_io: options.source_io,
		};
		return this._source_record_factory.source_records(record_options);
	}

	/** Responsibilities: _language source record assembly_. **/
	private assemble_source_records(options: ProjectContextAssemblyOptions): LintSourceRecordData[] {
		const { files, source_files } = options;
		let completed = false;
		try {
			const typescript_files = files.filter((file) => source_files.has(file));
			const python_files = files.filter((file) => !source_files.has(file));
			const typescript_records = this.source_records(options, typescript_files, new Map());
			const python_file_asts = options.source_preparation.complete_python_ast(options.python_batch);
			const python_records = this.source_records(options, python_files, python_file_asts);
			completed = true;
			return this.ordered_source_records(files, [...typescript_records, ...python_records]);
		} finally {
			if (!completed) {
				options.python_batch.source_files.cancel_source_ast(options.python_batch.batch);
			}
		}
	}

	/** Responsibilities: _project context assembly_. **/
	private project_context(
		options: ProjectContextAssemblyOptions,
		source_io: ProjectSourceIOContract,
	): LintProjectContextContract {
		const { files, source_files, stage_timer } = options;
		const sources = stage_timer.measure("startup.project-context.source-records", () =>
			this.assemble_source_records(options),
		);
		const statistics = this._source_record_factory.statistics(files, source_files);
		return stage_timer.measure(
			"startup.project-context.context-store",
			() => new LintProjectContextStore(sources, statistics, source_io),
		);
	}

	/** Responsibilities: _project source access_. **/
	private snapshot_source_io(
		virtual_project: boolean,
		provided_texts: ReadonlyMap<string, string>,
		ignore_files: readonly string[],
	): ProjectSourceIOContract {
		if (virtual_project && provided_texts.size > 0) {
			const snapshot = new Map(provided_texts);
			for (const file of ignore_files) {
				if (snapshot.has(file)) {
					continue;
				}
				const source_available = this._source_io.source_available(file);
				if (source_available) {
					const source_text = this._source_io.source_text(file);
					snapshot.set(file, source_text);
				}
			}
			return new InMemoryProjectSourceIO(snapshot);
		}
		return this._source_io;
	}

	/** Responsibilities: _project context source preparation_. **/
	private project_context_options(options: ProjectContextSourcePreparationOptions): ProjectContextAssemblyOptions {
		const preparation = new ProjectSourcePreparation({
			files: options.files,
			texts: options.texts,
			repo_root: options.repo_root,
			stage_timer: options.stage_timer,
			virtual_project: options.virtual_project,
			python_ast_parser: this._python_ast_parser,
		});
		const python_batch = preparation.begin_python_ast();
		const source_files = preparation.typescript_source_files();
		return { ...options, source_files, python_batch, source_preparation: preparation };
	}

	/** Responsibilities: _project text snapshot options_. **/
	private snapshot_options(request: LintProjectContextRequest): ProjectTextSnapshotOptions {
		const ignore_files = request.ignore_files;
		const source_io = this.snapshot_source_io(request.in_memory, request.source_texts, ignore_files);
		return {
			repo_root: request.repo_root,
			files: [...request.project_files],
			ignore_files,
			provided_texts: request.source_texts,
			configuration_snapshot_complete: request.configuration_snapshot_complete,
			stage_timer: request.stage_timer,
			virtual_project: request.in_memory,
			source_io,
		};
	}

	/** Responsibilities: _Python AST data ownership_, _project source identity_. **/
	public constructor(
		parser: PythonAstDataContract,
		analysis_identity: ProjectAnalysisIdentityContract,
		source_io: ProjectSourceIOContract,
		file_io: IOContract,
	) {
		this._source_record_factory = new ContextSourceRecordSet(analysis_identity, file_io);
		this._source_io = source_io;
		this._python_ast_parser = parser;
	}

	/** Responsibilities: _construction complete project context_. **/
	public snapshot(request: LintProjectContextRequest): LintProjectContextSnapshot {
		const snapshot_options = this.snapshot_options(request);
		const text_snapshot = new ProjectTextSnapshot(snapshot_options);
		const texts = text_snapshot.project_texts();
		return {
			repo_root: request.repo_root,
			files: request.project_files,
			texts,
			stage_timer: request.stage_timer,
			virtual_project: request.in_memory,
			source_io: new InMemoryProjectSourceIO(texts),
		};
	}

	/** Responsibilities: _project context construction_. **/
	public lint_context(snapshot: LintProjectContextSnapshot): LintProjectContextContract {
		const { repo_root, files, texts, stage_timer, virtual_project, source_io } = snapshot;
		const context_options = this.project_context_options({
			repo_root,
			files: [...files],
			texts,
			stage_timer,
			virtual_project,
			source_io,
		});
		return this.project_context(context_options, source_io);
	}
}
