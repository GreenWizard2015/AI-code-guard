import { resolve } from "node:path";
import type {
	FileAnalysisCacheEntryOptions,
	FileAnalysisCacheRecordIdentity,
} from "src/contracts/protocols/lint_runtime_protocols";
import { ViolationCache } from "src/core/cache/violation_cache";
import { FILE_ANALYSIS_CACHE_VERSION } from "src/core/constants";
import type { CacheState, FileAnalysisCacheRecord } from "src/project_analysis_types";
import type { ReportViolationOptions } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";

/** Responsibilities: _file cache entry identity_, _diagnostic cache validation_. **/
export class FileAnalysisCacheEntry {
	private readonly _cache_file: string;
	private readonly _context_hash: string;
	private readonly _source_file: string;
	private readonly _source_hash: string;
	private readonly _ignored: boolean;

	/** Responsibilities: _cache record identity matching_. **/
	private identity_matches(identity: FileAnalysisCacheRecordIdentity): boolean {
		if (identity.version !== FILE_ANALYSIS_CACHE_VERSION || identity.context_hash !== this._context_hash) {
			return false;
		}
		if (identity.source_file !== this._source_file || identity.source_hash !== this._source_hash) {
			return false;
		}
		if (identity.ignored !== this._ignored) {
			return false;
		}
		return resolve(identity.cache_file) === this._cache_file;
	}

	/** Responsibilities: _cache record identity validation_. **/
	private record_fields_valid(record: FileAnalysisCacheRecord): boolean {
		if (record === null || typeof record !== "object" || Array.isArray(record)) {
			return false;
		}
		if (!Number.isFinite(record.cache_version) || !Array.isArray(record.violations)) {
			return false;
		}
		if (String(record.context_hash) !== record.context_hash) {
			return false;
		}
		if (String(record.source_file) !== record.source_file || String(record.source_hash) !== record.source_hash) {
			return false;
		}
		if (record.ignored !== true && record.ignored !== false) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _cached violation values_. **/
	private violation_values(violations: readonly ReportViolationOptions[]): CacheState<ViolationContract[]> {
		const cache = new ViolationCache(violations);
		if (!cache.valid_cache()) {
			return { available: false, value: [] };
		}
		return { available: true, value: [...cache.values()] };
	}

	/** Responsibilities: _entry identity initialization_. **/
	public constructor(options: FileAnalysisCacheEntryOptions) {
		const identity = `${FILE_ANALYSIS_CACHE_VERSION}\u0000${options.context_hash}\u0000${resolve(options.file)}\u0000${options.source_hash}\u0000${options.ignored}`;
		this._cache_file = resolve(options.cache_directory, `${options.analysis_identity.content(identity)}.json`);
		this._context_hash = options.context_hash;
		this._source_file = resolve(options.file);
		this._source_hash = options.source_hash;
		this._ignored = options.ignored;
	}

	/** Responsibilities: _cache file path_. **/
	public path(): string {
		return this._cache_file;
	}

	/** Responsibilities: _cache record construction_. **/
	public record(violations: readonly ViolationContract[]): FileAnalysisCacheRecord {
		return {
			cache_version: FILE_ANALYSIS_CACHE_VERSION,
			context_hash: this._context_hash,
			source_file: this._source_file,
			source_hash: this._source_hash,
			ignored: this._ignored,
			violations: violations.map((violation) => ({
				file: violation.file(),
				line: violation.line(),
				message: violation.message(),
				hint: violation.hint(),
				rule_id: violation.rule_id(),
				priority: violation.priority(),
			})),
		};
	}

	/** Responsibilities: _cached diagnostics restoration_. **/
	public cached_violations(record: FileAnalysisCacheRecord, path: string): CacheState<ViolationContract[]> {
		if (!this.record_fields_valid(record)) {
			return { available: false, value: [] };
		}
		const identity = {
			version: record.cache_version,
			context_hash: record.context_hash,
			source_file: record.source_file,
			source_hash: record.source_hash,
			ignored: record.ignored,
			cache_file: path,
		};
		if (!this.identity_matches(identity)) {
			return { available: false, value: [] };
		}
		return this.violation_values(record.violations);
	}
}
