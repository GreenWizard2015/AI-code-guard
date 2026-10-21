import { join, resolve } from "node:path";
import type { FileAnalysisCacheContract } from "src/cache_protocols";
import { AI_CODE_GUARD_DIRECTORY } from "src/constants";
import { ViolationCache } from "src/core/cache/violation_cache";
import { FILE_ANALYSIS_CACHE_VERSION } from "src/core/constants";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";
import type { IOContract } from "src/io/protocols";
import { TypeScriptProjectResolution } from "src/module-resolution/type_script_project_resolution";
import type { CacheState, FileAnalysisCacheRecord } from "src/project_analysis_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { ProjectAnalysisIdentityContract } from "src/runtime_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type { LintSourceRecord } from "src/source_types";

/** Responsibilities: _persistent file-analysis cache_, _project-context invalidation_. **/
export class FileAnalysisCache implements FileAnalysisCacheContract {
	private readonly cache_directory: string;
	private readonly context_hash: string;
	private readonly analysis_identity: ProjectAnalysisIdentityContract;
	private readonly resolution_identity: string;
	private readonly file_io: IOContract;
	private readonly boundary_failures: BoundaryFailureClassifier;

	/** Responsibilities: _cache filename construction_. **/
	private cache_path(file: string, source_hash: string, ignored: boolean): string {
		const key = this.analysis_identity.content(
			`${FILE_ANALYSIS_CACHE_VERSION}\u0000${this.context_hash}\u0000${resolve(file)}\u0000${source_hash}\u0000${ignored}`,
		);
		return join(this.cache_directory, `${key}.json`);
	}

	/** Responsibilities: _file cache record fields_. **/
	private record_fields_valid(record: FileAnalysisCacheRecord): boolean {
		if (record === null || typeof record !== "object" || Array.isArray(record)) {
			return false;
		}
		const valid_identity_fields =
			Number.isFinite(record.cache_version) &&
			String(record.context_hash) === record.context_hash &&
			String(record.source_file) === record.source_file &&
			String(record.source_hash) === record.source_hash;
		const valid_ignored_flag = record.ignored === true || record.ignored === false;
		return valid_identity_fields && valid_ignored_flag && Array.isArray(record.violations);
	}

	/** Responsibilities: _cache record validation_. **/
	private valid_record(
		record: FileAnalysisCacheRecord,
		file: string,
		text: string,
		ignored: boolean,
		path: string,
	): boolean {
		if (!this.record_fields_valid(record)) {
			return false;
		}
		if (record.cache_version !== FILE_ANALYSIS_CACHE_VERSION) {
			return false;
		}
		if (record.context_hash !== this.context_hash || record.source_file !== resolve(file)) {
			return false;
		}
		if (record.source_hash !== this.analysis_identity.content(text) || record.ignored !== ignored) {
			return false;
		}
		return resolve(path) === resolve(this.cache_path(file, record.source_hash, ignored));
	}

	/** Responsibilities: _cached file violation validation_. **/
	private record_violations(
		record: FileAnalysisCacheRecord,
		file: string,
		text: string,
		ignored: boolean,
		path: string,
	): CacheState<ViolationContract[]> {
		if (!this.valid_record(record, file, text, ignored, path)) {
			return { available: false, value: [] };
		}
		const cache = new ViolationCache(record.violations);
		if (!cache.valid_cache()) {
			return { available: false, value: [] };
		}
		return { available: true, value: [...cache.values()] };
	}

	/** Responsibilities: _atomic cache persistence_. **/
	private persist(path: string, record: FileAnalysisCacheRecord): void {
		const temporary = `${path}.${process.pid}.tmp`;
		this.file_io.file_content.write_text(temporary, JSON.stringify(record));
		this.file_io.file_operations.move_file(temporary, path);
	}

	/** Responsibilities: _stale file-analysis record detection_. **/
	private stale_record(path: string, current: ReadonlyMap<string, string>): boolean {
		try {
			const record: FileAnalysisCacheRecord = JSON.parse(this.file_io.file_content.file_text(path));
			if (!this.record_fields_valid(record)) {
				return true;
			}
			const source_file = resolve(record.source_file);
			const text = current.get(source_file);
			if (text === undefined) {
				return true;
			}
			return !this.valid_record(record, source_file, text, record.ignored, path);
		} catch (error) {
			if (!this.boundary_failures.cache_read_failure(String(error))) {
				throw error;
			}
			return true;
		}
	}

	/** Responsibilities: _stale file-analysis record deletion_. **/
	private remove_unused_record(path: string, current: ReadonlyMap<string, string>): void {
		if (this.stale_record(path, current)) {
			this.file_io.file_operations.remove_file(path);
		}
	}

	/** Responsibilities: _cache initialization_, _project identity_. **/
	public constructor(
		repo_root: string,
		records: readonly LintSourceRecord[],
		analysis_identity: ProjectAnalysisIdentityContract,
		file_io: IOContract,
		source_io: ProjectSourceIOContract,
	) {
		this.analysis_identity = analysis_identity;
		this.file_io = file_io;
		this.boundary_failures = new BoundaryFailureClassifier();
		const project_resolution = new TypeScriptProjectResolution(resolve(repo_root), source_io);
		this.resolution_identity = project_resolution.configuration_identity();
		this.cache_directory = join(resolve(repo_root), AI_CODE_GUARD_DIRECTORY, "cache", "file");
		this.context_hash = this.analysis_identity.content(
			`${this.analysis_identity.context(records)}\u0000${this.analysis_identity.directory_context(repo_root)}\u0000${this.resolution_identity}`,
		);
	}

	/** Responsibilities: _cached file violations retrieval_. **/
	public cached_violations(file: string, text: string, ignored: boolean): CacheState<ViolationContract[]> {
		const source_hash = this.analysis_identity.content(text);
		const path = this.cache_path(file, source_hash, ignored);
		try {
			const record: FileAnalysisCacheRecord = JSON.parse(this.file_io.file_content.file_text(path));
			return this.record_violations(record, file, text, ignored, path);
		} catch (error) {
			if (!this.boundary_failures.cache_read_failure(String(error))) {
				throw error;
			}
			return { available: false, value: [] };
		}
	}

	/** Responsibilities: _file violations persistence_. **/
	public write(file: string, text: string, ignored: boolean, violations: readonly ViolationContract[]): void {
		const source_hash = this.analysis_identity.content(text);
		const path = this.cache_path(file, source_hash, ignored);
		const record: FileAnalysisCacheRecord = {
			cache_version: FILE_ANALYSIS_CACHE_VERSION,
			context_hash: this.context_hash,
			source_file: resolve(file),
			source_hash,
			ignored,
			violations: violations.map((violation) => violation.details()),
		};
		try {
			this.file_io.directory_operations.create_directory(this.cache_directory);
			this.persist(path, record);
		} catch (error) {
			if (!this.boundary_failures.system_failure_message(String(error))) {
				throw error;
			}
		}
	}

	/** Responsibilities: _stale file-analysis cache removal_. **/
	public clean_unused_records(records: readonly LintSourceRecord[]): void {
		const current = new Map(records.map((record) => [resolve(record.absolute_path), record.text]));
		try {
			for (const entry of this.file_io.directory_entries.list_entries(this.cache_directory)) {
				if (!entry.is_file || !entry.name.endsWith(".json")) {
					continue;
				}
				this.remove_unused_record(join(this.cache_directory, entry.name), current);
			}
		} catch (error) {
			if (!this.boundary_failures.system_failure_message(String(error))) {
				throw error;
			}
		}
	}
}
