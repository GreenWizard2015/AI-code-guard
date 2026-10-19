import { join, resolve } from "node:path";
import { GLOBAL_ANALYSIS_CACHE_VERSION } from "src/core/constants";
import { AI_CODE_GUARD_DIRECTORY } from "src/constants";
import { ViolationCache } from "src/core/cache/violation_cache";
import { TypeScriptProjectResolution } from "src/module-resolution/type_script_project_resolution";
import type { GlobalAnalysisCacheContract, GlobalAnalysisCacheOptions, ViolationContract } from "src/protocols";
import type { CacheState, GlobalAnalysisCacheRecord } from "src/types";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _persistent global-analysis cache_, _selection invalidation_. **/
export class GlobalAnalysisCache implements GlobalAnalysisCacheContract {
	private readonly cache_directory: string;
	private readonly cache_file: string;
	private readonly context_hash: string;
	private readonly selection_hash: string;
	private readonly project_resolution: TypeScriptProjectResolution;
	private readonly file_io: IOContract;

	/** Responsibilities: _global cache record deletion_. **/
	private remove_unused_record(entry_path: string): void {
		if (entry_path !== this.cache_file) {
			this.file_io.file_operations.remove_file(entry_path);
		}
	}

	/** Responsibilities: _stale global cache cleanup_. **/
	private clean_unused_records(): void {
		try {
			for (const entry of this.file_io.directory_entries.list_entries(this.cache_directory)) {
				const entry_path = join(this.cache_directory, entry.name);
				if (!entry.is_file) {
					continue;
				}
				if (!entry.name.endsWith(".json")) {
					continue;
				}
				this.remove_unused_record(entry_path);
			}
		} catch (error) {
			void error;
			return;
		}
	}

	/** Responsibilities: _cached global violations retrieval_. **/
	private read_cached_violations(): CacheState<ViolationContract[]> {
		try {
			const record: GlobalAnalysisCacheRecord = JSON.parse(this.file_io.file_content.file_text(this.cache_file));
			if (record.cache_version !== GLOBAL_ANALYSIS_CACHE_VERSION) {
				return { available: false, value: [] };
			}
			if (record.context_hash !== this.context_hash || record.selection_hash !== this.selection_hash) {
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

	/** Responsibilities: _global cache initialization_. **/
	public constructor(options: GlobalAnalysisCacheOptions) {
		this.file_io = options.file_io;
		this.cache_directory = join(resolve(options.repo_root), AI_CODE_GUARD_DIRECTORY, "cache", "global");
		this.project_resolution = new TypeScriptProjectResolution(resolve(options.repo_root), options.source_io);
		const resolution_identity = this.project_resolution.configuration_identity();
		const context_identity = options.identity.context(options.records);
		this.context_hash = options.identity.content(`${context_identity}\u0000${resolution_identity}`);
		this.selection_hash = options.identity.selection(
			options.files,
			options.ignored_files,
			new Set(options.entry_files),
		);
		this.cache_file = join(
			this.cache_directory,
			`${this.context_hash}-${this.selection_hash}-${GLOBAL_ANALYSIS_CACHE_VERSION}.json`,
		);
	}

	/** Responsibilities: _cached global violations retrieval_. **/
	public cached_violations(): CacheState<ViolationContract[]> {
		this.clean_unused_records();
		return this.read_cached_violations();
	}

	/** Responsibilities: _global violations persistence_. **/
	public write(violations: readonly ViolationContract[]): void {
		const record: GlobalAnalysisCacheRecord = {
			cache_version: GLOBAL_ANALYSIS_CACHE_VERSION,
			context_hash: this.context_hash,
			selection_hash: this.selection_hash,
			violations: violations.map((violation) => violation.details()),
		};
		try {
			this.file_io.directory_operations.create_directory(this.cache_directory);
			const temporary = `${this.cache_file}.${process.pid}.tmp`;
			this.file_io.file_content.write_text(temporary, JSON.stringify(record));
			this.file_io.file_operations.move_file(temporary, this.cache_file);
		} catch (error) {
			void error;
			return;
		}
	}
}
