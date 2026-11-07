import { createHash, randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import type { SystemFailureClassificationContract } from "src/analysis_protocols";
import { BoundaryFailureCategory } from "src/analysis_protocols";
import type { AstCacheAst } from "src/cache_types";
import { AI_CODE_GUARD_DIRECTORY, TYPESCRIPT_CACHE_OWNER } from "src/constants";
import { AstCacheAstSerializer } from "src/core/cache/ast-disk-cache/ast_cache_ast_serializer";
import { AstCacheMiss } from "src/core/cache/ast-disk-cache/ast_cache_miss";
import { AstCacheRecordState } from "src/core/cache/ast-disk-cache/ast_cache_record_state";
import { AST_ANALYSIS_CACHE_VERSION, CACHE_DIRECTORY } from "src/core/constants";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";
import { SYSTEM_FAILURE_CODES } from "src/io/constants";
import type { IOContract } from "src/io/protocols";
import type { NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import type { AstCacheRecord } from "src/model_types";
import type { ProjectAnalysisIdentityContract } from "src/runtime_protocols";
import type { AstCacheEntryContract, AstDiskCacheContract } from "src/source_protocols";

/** Responsibilities: _AST cache storage_, _source freshness_. **/
export class AstDiskCache implements AstDiskCacheContract {
	private readonly _cache_directory: string;
	private readonly _project_identity: string;
	private readonly _analysis_identity: ProjectAnalysisIdentityContract;
	private readonly _file_io: IOContract;
	private readonly _boundary_failures: SystemFailureClassificationContract;

	/** Responsibilities: _cache filename hash construction_. **/
	private cache_path(absolute_file: string, source_hash: string): string {
		const key = createHash("sha256")
			.update(`${AST_ANALYSIS_CACHE_VERSION}\u0000${this._project_identity}\u0000${absolute_file}\u0000${source_hash}`)
			.digest("hex");
		return join(this._cache_directory, `${key}.json`);
	}

	/** Responsibilities: _unused cache record detection_. **/
	private stale_record(file: string): boolean {
		try {
			const record: AstCacheRecord = JSON.parse(this._file_io.file(file).file_text());
			const state = new AstCacheRecordState(this._cache_directory, file, this._project_identity, record);
			return state.stale(this._file_io);
		} catch (error) {
			if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.CacheRead)) {
				throw error;
			}
			return true;
		}
	}

	/** Responsibilities: _unused cache record deletion_. **/
	private remove_unused_record(file: string): void {
		if (this.stale_record(file)) {
			try {
				this._file_io.file(file).remove_file();
			} catch (error) {
				if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.System)) {
					throw error;
				}
			}
		}
	}

	/** Responsibilities: _failed atomic-write temporary cleanup_. **/
	private clean_temporary_record(path: string): void {
		if (!this._file_io.file(path).path_exists()) {
			return;
		}
		try {
			this._file_io.file(path).remove_file();
		} catch (error) {
			if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.System)) {
				throw error;
			}
		}
	}

	/** Responsibilities: _atomic cache record persistence_. **/
	private persist_record(path: string, record: AstCacheRecord): void {
		const temporary_path = `${path}.${process.pid}.${randomUUID()}.tmp`;
		const serialized = JSON.stringify(record);
		try {
			this._file_io.file(temporary_path).write_text(serialized);
			this._file_io.file(temporary_path).move_to(this._file_io.file(path));
		} finally {
			this.clean_temporary_record(temporary_path);
		}
	}

	/** Responsibilities: _AST cache record construction_. **/
	private cache_record(absolute_source_file: string, source_hash: string, ast: AstCacheAst): AstCacheRecord {
		return {
			cache_version: AST_ANALYSIS_CACHE_VERSION,
			project_identity: this._project_identity,
			source_file: absolute_source_file,
			source_hash,
			ast,
		};
	}

	/** Responsibilities: _AST cache initialization_. **/
	public constructor(
		repo_root: string,
		project_identity: string,
		analysis_identity: ProjectAnalysisIdentityContract,
		cache_owner: string,
		file_io: IOContract,
	) {
		let resolved_cache_owner = TYPESCRIPT_CACHE_OWNER;
		if (cache_owner.length > 0) {
			resolved_cache_owner = cache_owner;
		}
		this._cache_directory = join(
			resolve(repo_root),
			AI_CODE_GUARD_DIRECTORY,
			CACHE_DIRECTORY,
			"ast",
			resolved_cache_owner,
		);
		this._analysis_identity = analysis_identity;
		this._file_io = file_io;
		this._boundary_failures = new BoundaryFailureClassifier(SYSTEM_FAILURE_CODES);
		this._project_identity = `${project_identity}\u0000${this._analysis_identity.analyzer()}`;
	}

	/** Responsibilities: _unused cache entry removal_. **/
	public clean_unused_records(): void {
		if (!this._file_io.file(this._cache_directory).path_exists()) {
			return;
		}
		for (const entry of this._file_io.list_files(this._cache_directory)) {
			if (!entry.endsWith(".json")) {
				continue;
			}
			this.remove_unused_record(join(this._cache_directory, entry));
		}
	}

	/** Responsibilities: _persistent AST content resolution_. **/
	public content(source_file: string, source_text: string): AstCacheEntryContract {
		try {
			const absolute_file = resolve(source_file);
			const source_file_hash = createHash("sha256").update(source_text).digest("hex");
			const path = this.cache_path(absolute_file, source_file_hash);
			const record: AstCacheRecord = JSON.parse(this._file_io.file(path).file_text());
			const state = new AstCacheRecordState(this._cache_directory, path, this._project_identity, record);
			return state.entry(source_file, source_file_hash);
		} catch (error) {
			if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.CacheRead)) {
				throw error;
			}
			return new AstCacheMiss(source_file, "cache file unavailable");
		}
	}

	/** Responsibilities: _persistent AST storage_. **/
	public write(source_file: string, source_text: string, ast: NormalizedAstFile): void {
		try {
			const absolute_file = resolve(source_file);
			const source_hash = createHash("sha256").update(source_text).digest("hex");
			const path = this.cache_path(absolute_file, source_hash);
			const serializer = new AstCacheAstSerializer(ast);
			const serialized_ast = serializer.value();
			this._file_io.create_directory(this._cache_directory);
			const record = this.cache_record(absolute_file, source_hash, serialized_ast);
			this.persist_record(path, record);
		} catch (error) {
			if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.System)) {
				throw error;
			}
		}
	}
}
