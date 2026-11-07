import { join, resolve } from "node:path";
import type { SystemFailureClassificationContract } from "src/analysis_protocols";
import { BoundaryFailureCategory } from "src/analysis_protocols";
import type { FileAnalysisCacheContract } from "src/cache_protocols";
import type { FileAnalysisCacheOptions } from "src/cache_types";
import { AI_CODE_GUARD_DIRECTORY } from "src/constants";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";
import { SYSTEM_FAILURE_CODES } from "src/io/constants";
import type { IOContract } from "src/io/protocols";
import { FileAnalysisCacheEntry } from "src/linting/orchestration/runtime/file_analysis_cache_entry";
import { TypeScriptProjectResolution } from "src/module-resolution/project-resolution/type_script_project_resolution";
import type { CacheState, FileAnalysisCacheRecord } from "src/project_analysis_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { ProjectAnalysisIdentityContract } from "src/runtime_protocols";
import type { LintSourceRecordData } from "src/source_types";

/** Responsibilities: _persistent file-analysis cache_, _project-context invalidation_. **/
export class FileAnalysisCache implements FileAnalysisCacheContract {
	private readonly _cache_directory: string;
	private readonly _context_hash: string;
	private readonly _analysis_identity: ProjectAnalysisIdentityContract;
	private readonly _resolution_identity: string;
	private readonly _file_io: IOContract;
	private readonly _boundary_failures: SystemFailureClassificationContract;

	/** Responsibilities: _atomic cache persistence_. **/
	private persist(target_file: string, payload: FileAnalysisCacheRecord): void {
		const temporary = `${target_file}.${process.pid}.tmp`;
		this._file_io.file(temporary).write_text(JSON.stringify(payload));
		this._file_io.file(temporary).move_to(this._file_io.file(target_file));
	}

	/** Responsibilities: _cache candidate metadata validation_. **/
	private candidate_valid(record: FileAnalysisCacheRecord): boolean {
		if (record === null || typeof record !== "object" || Array.isArray(record)) {
			return false;
		}
		if (String(record.source_file) !== record.source_file) {
			return false;
		}
		return record.ignored === true || record.ignored === false;
	}

	/** Responsibilities: _cache candidate validation_. **/
	private stale_candidate(
		cache_file: string,
		record: FileAnalysisCacheRecord,
		current: ReadonlyMap<string, string>,
	): boolean {
		if (!this.candidate_valid(record)) {
			return true;
		}
		const source_file = resolve(record.source_file);
		const text = current.get(source_file);
		if (text === undefined) {
			return true;
		}
		const entry = new FileAnalysisCacheEntry({
			cache_directory: this._cache_directory,
			context_hash: this._context_hash,
			file: source_file,
			source_hash: this._analysis_identity.content(text),
			ignored: record.ignored,
			analysis_identity: this._analysis_identity,
		});
		return !entry.cached_violations(record, cache_file).available;
	}

	/** Responsibilities: _stale cache record detection_. **/
	private stale_record(cache_file: string, current: ReadonlyMap<string, string>): boolean {
		try {
			const record: FileAnalysisCacheRecord = JSON.parse(this._file_io.file(cache_file).file_text());
			return this.stale_candidate(cache_file, record, current);
		} catch (error) {
			if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.CacheRead)) {
				throw error;
			}
			return true;
		}
	}

	/** Responsibilities: _cache initialization_, _project identity_. **/
	public constructor(options: FileAnalysisCacheOptions) {
		this._analysis_identity = options.analysis_identity;
		this._file_io = options.file_io;
		this._boundary_failures = new BoundaryFailureClassifier(SYSTEM_FAILURE_CODES);
		const project_resolution = new TypeScriptProjectResolution(resolve(options.repo_root), options.source_io);
		this._resolution_identity = project_resolution.configuration_identity();
		this._cache_directory = join(resolve(options.repo_root), AI_CODE_GUARD_DIRECTORY, "cache", "file");
		this._context_hash = this._analysis_identity.content(
			`${options.context_identity}\u0000${this._analysis_identity.directory_context(options.repo_root)}\u0000${this._resolution_identity}`,
		);
	}

	/** Responsibilities: _cached file violations retrieval_. **/
	public cached_violations(file: string, text: string, ignored: boolean): CacheState<ViolationContract[]> {
		const entry = new FileAnalysisCacheEntry({
			cache_directory: this._cache_directory,
			context_hash: this._context_hash,
			file,
			source_hash: this._analysis_identity.content(text),
			ignored,
			analysis_identity: this._analysis_identity,
		});
		try {
			const record: FileAnalysisCacheRecord = JSON.parse(this._file_io.file(entry.path()).file_text());
			return entry.cached_violations(record, entry.path());
		} catch (error) {
			if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.CacheRead)) {
				throw error;
			}
			return { available: false, value: [] };
		}
	}

	/** Responsibilities: _file violations persistence_. **/
	public write(file: string, text: string, ignored: boolean, violations: readonly ViolationContract[]): void {
		const entry = new FileAnalysisCacheEntry({
			cache_directory: this._cache_directory,
			context_hash: this._context_hash,
			file,
			source_hash: this._analysis_identity.content(text),
			ignored,
			analysis_identity: this._analysis_identity,
		});
		const record = entry.record(violations);
		try {
			this._file_io.create_directory(this._cache_directory);
			this.persist(entry.path(), record);
		} catch (error) {
			if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.System)) {
				throw error;
			}
		}
	}

	/** Responsibilities: _stale file-analysis cache removal_. **/
	public clean_unused_records(records: readonly LintSourceRecordData[]): void {
		const current = new Map(records.map((record) => [resolve(record.absolute_path), record.text]));
		try {
			for (const entry of this._file_io.list_entries(this._cache_directory)) {
				if (!entry.is_file || !entry.name.endsWith(".json")) {
					continue;
				}
				const cache_file = join(this._cache_directory, entry.name);
				if (this.stale_record(cache_file, current)) {
					this._file_io.file(cache_file).remove_file();
				}
			}
		} catch (error) {
			if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.System)) {
				throw error;
			}
		}
	}
}
