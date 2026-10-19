import { join, resolve } from "node:path";
import { FILE_ANALYSIS_CACHE_VERSION } from "src/core/constants";
import { ViolationCache } from "src/core/cache/violation_cache";
import type { LintSourceRecord } from "src/types";
import type {
	FileAnalysisCacheContract,
	ProjectAnalysisIdentityContract,
	ProjectSourceIOContract,
	ViolationContract,
} from "src/protocols";
import type { CacheState, FileAnalysisCacheRecord } from "src/types";
import { AI_CODE_GUARD_DIRECTORY } from "src/constants";
import { TypeScriptProjectResolution } from "src/module-resolution/type_script_project_resolution";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _persistent file-analysis cache_, _project-context invalidation_. **/
export class FileAnalysisCache implements FileAnalysisCacheContract {
	private readonly cache_directory: string;
	private readonly context_hash: string;
	private readonly analysis_identity: ProjectAnalysisIdentityContract;
	private readonly resolution_identity: string;
	private readonly file_io: IOContract;

	/** Responsibilities: _cache filename construction_. **/
	private cache_path(file: string, source_hash: string, ignored: boolean): string {
		const key = this.analysis_identity.content(
			`${FILE_ANALYSIS_CACHE_VERSION}\u0000${this.context_hash}\u0000${resolve(file)}\u0000${source_hash}\u0000${ignored}`,
		);
		return join(this.cache_directory, `${key}.json`);
	}

	/** Responsibilities: _cache record validation_. **/
	private valid_record(
		record: FileAnalysisCacheRecord,
		file: string,
		text: string,
		ignored: boolean,
		path: string,
	): boolean {
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
			const source_file = resolve(record.source_file);
			const text = current.get(source_file);
			if (text === undefined) {
				return true;
			}
			return !this.valid_record(record, source_file, text, record.ignored, path);
		} catch (error) {
			void error;
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
			if (!this.valid_record(record, file, text, ignored, path)) {
				return { available: false, value: [] };
			}
			const cache = new ViolationCache(record.violations);
			if (!cache.valid_cache()) {
				return { available: false, value: [] };
			}
			return { available: true, value: [...cache.values()] };
		} catch (error) {
			void error;
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
			void error;
			return;
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
			void error;
			return;
		}
	}
}
