import { join, resolve } from "node:path";
import type { SystemFailureClassificationContract } from "src/analysis_protocols";
import { BoundaryFailureCategory } from "src/analysis_protocols";
import type { GlobalAnalysisCacheContract } from "src/cache_protocols";
import type { GlobalAnalysisCacheOptions } from "src/cache_types";
import { AI_CODE_GUARD_DIRECTORY, MISSING_CACHE_VALUE, PYTHON_PROJECT_CONFIGURATION_FILE } from "src/constants";
import { GlobalCacheLifecycle } from "src/core/cache/global_cache_lifecycle";
import { ViolationCache } from "src/core/cache/violation_cache";
import { GLOBAL_ANALYSIS_CACHE_VERSION } from "src/core/constants";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";
import { SYSTEM_FAILURE_CODES } from "src/io/constants";
import type { IOContract } from "src/io/protocols";
import { TypeScriptProjectResolution } from "src/module-resolution/project-resolution/type_script_project_resolution";
import type { CacheState, GlobalAnalysisCacheRecord } from "src/project_analysis_types";
import type { ReportViolationOptions, ViolationContract } from "src/reporting_protocols";

/** Responsibilities: _persistent global-analysis cache_, _selection invalidation_. **/
export class GlobalAnalysisCache implements GlobalAnalysisCacheContract {
	private readonly _cache_directory: string;
	private readonly _cache_file: string;
	private readonly _context_hash: string;
	private readonly _selection_hash: string;
	private readonly _project_resolution: TypeScriptProjectResolution;
	private readonly _file_io: IOContract;
	private readonly _boundary_failures: SystemFailureClassificationContract;
	private readonly _lifecycle: GlobalCacheLifecycle;

	/** Responsibilities: _cached record identity validation_. **/
	private record_is_current(record: GlobalAnalysisCacheRecord): boolean {
		if (record === null || typeof record !== "object" || Array.isArray(record)) {
			return false;
		}
		const valid_record_fields =
			Number.isFinite(record.cache_version) &&
			String(record.context_hash) === record.context_hash &&
			String(record.selection_hash) === record.selection_hash &&
			Array.isArray(record.violations);
		if (!valid_record_fields) {
			return false;
		}
		if (record.cache_version !== GLOBAL_ANALYSIS_CACHE_VERSION) {
			return false;
		}
		if (record.context_hash !== this._context_hash) {
			return false;
		}
		return record.selection_hash === this._selection_hash;
	}

	/** Responsibilities: _cached violation record validation_. **/
	private validated_violations(record: GlobalAnalysisCacheRecord): CacheState<ViolationContract[]> {
		if (!this.record_is_current(record)) {
			return { available: false, value: [] };
		}
		const cache = new ViolationCache(record.violations);
		if (!cache.valid_cache()) {
			return { available: false, value: [] };
		}
		return { available: true, value: [...cache.values()] };
	}

	/** Responsibilities: _cached record text access_. **/
	private cached_record_text(): CacheState<string> {
		try {
			return { available: true, value: this._file_io.file(this._cache_file).file_text() };
		} catch (error) {
			if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.CacheRead)) {
				throw error;
			}
			return { available: false, value: "" };
		}
	}

	/** Responsibilities: _cached violation decoding_. **/
	private decode_violations(record_text: string): CacheState<ViolationContract[]> {
		let record: GlobalAnalysisCacheRecord;
		try {
			record = JSON.parse(record_text);
		} catch (error) {
			if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.CacheRead)) {
				throw error;
			}
			return { available: false, value: [] };
		}
		return this.validated_violations(record);
	}

	/** Responsibilities: _global violation cache serialization_. **/
	private violation_options(violations: readonly ViolationContract[]): ReportViolationOptions[] {
		return violations.map((violation) => ({
			file: violation.file(),
			line: violation.line(),
			message: violation.message(),
			hint: violation.hint(),
			rule_id: violation.rule_id(),
			priority: violation.priority(),
		}));
	}

	/** Responsibilities: _global cache initialization_. **/
	public constructor(options: GlobalAnalysisCacheOptions) {
		this._file_io = options.file_io;
		this._boundary_failures = new BoundaryFailureClassifier(SYSTEM_FAILURE_CODES);
		this._cache_directory = join(resolve(options.repo_root), AI_CODE_GUARD_DIRECTORY, "cache", "global");
		this._lifecycle = new GlobalCacheLifecycle(
			this._cache_directory,
			this._file_io,
			this._boundary_failures,
			options.temporary_write_paths,
		);
		this._project_resolution = new TypeScriptProjectResolution(resolve(options.repo_root), options.source_io);
		const resolution_identity = this._project_resolution.configuration_identity();
		const project_configuration = join(resolve(options.repo_root), PYTHON_PROJECT_CONFIGURATION_FILE);
		let project_configuration_text = MISSING_CACHE_VALUE;
		if (options.source_io.source_available(project_configuration)) {
			project_configuration_text = options.source_io.source_text(project_configuration);
		}
		const project_configuration_identity = options.identity.content(project_configuration_text);
		this._context_hash = options.identity.content(
			`${options.context_identity}\u0000${resolution_identity}\u0000${project_configuration_identity}`,
		);
		this._selection_hash = options.identity.selection(
			options.files,
			options.ignored_files,
			new Set(options.entry_files),
		);
		this._cache_file = join(
			this._cache_directory,
			`${this._context_hash}-${this._selection_hash}-${GLOBAL_ANALYSIS_CACHE_VERSION}.json`,
		);
	}

	/** Responsibilities: _cached global violations retrieval_. **/
	public cached_violations(): CacheState<ViolationContract[]> {
		this._lifecycle.clean({ current_record: this._cache_file, remove_records: true });
		const cached_text = this.cached_record_text();
		if (!cached_text.available) {
			return { available: false, value: [] };
		}
		return this.decode_violations(cached_text.value);
	}

	/** Responsibilities: _global violations persistence_. **/
	public write(violations: readonly ViolationContract[]): void {
		const record: GlobalAnalysisCacheRecord = {
			cache_version: GLOBAL_ANALYSIS_CACHE_VERSION,
			context_hash: this._context_hash,
			selection_hash: this._selection_hash,
			violations: this.violation_options(violations),
		};
		this._lifecycle.publish(this._cache_file, JSON.stringify(record));
	}
}
