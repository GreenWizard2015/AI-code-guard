import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import type { SystemFailureClassificationContract } from "src/analysis_protocols";
import { BoundaryFailureCategory } from "src/analysis_protocols";
import { AI_CODE_GUARD_DIRECTORY, TYPESCRIPT_CACHE_OWNER } from "src/constants";
import { AstCacheAstSerializer } from "src/core/cache/ast-disk-cache/ast_cache_ast_serializer";
import { AstDiskCacheRecordCleanup } from "src/core/cache/ast-disk-cache/ast_disk_cache_record_cleanup";
import { AstDiskCacheTemporaryFiles } from "src/core/cache/ast-disk-cache/ast_disk_cache_temporary_files";
import type { AstCachePublication, AstCacheWriteRequest } from "src/core/cache/ast-disk-cache/types";
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
	private readonly _file_io: IOContract;
	private readonly _boundary_failures: SystemFailureClassificationContract;
	private readonly _temporary_files: AstDiskCacheTemporaryFiles;
	private readonly _record_cleanup: AstDiskCacheRecordCleanup;
	private readonly _cleaned_entries: Map<string, AstCacheEntryContract>;

	/** Responsibilities: _cache filename hash construction_. **/
	private cache_path(absolute_file: string, source_hash: string): string {
		const key = createHash("sha256")
			.update(`${AST_ANALYSIS_CACHE_VERSION}\u0000${this._project_identity}\u0000${absolute_file}\u0000${source_hash}`)
			.digest("hex");
		return join(this._cache_directory, `${key}.json`);
	}

	/** Responsibilities: _cache record preparation_. **/
	private prepare_record(request: AstCacheWriteRequest): AstCachePublication {
		const absolute_file = resolve(request.source_file);
		const source_hash = createHash("sha256").update(request.source_text).digest("hex");
		const path = this.cache_path(absolute_file, source_hash);
		this._cleaned_entries.delete(resolve(path));
		const serializer = new AstCacheAstSerializer(request.ast);
		const record: AstCacheRecord = {
			cache_version: AST_ANALYSIS_CACHE_VERSION,
			project_identity: this._project_identity,
			source_file: absolute_file,
			source_hash,
			ast: serializer.value(),
		};
		return { path, record };
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
		this._file_io = file_io;
		this._boundary_failures = new BoundaryFailureClassifier(SYSTEM_FAILURE_CODES);
		this._project_identity = `${project_identity}\u0000${analysis_identity.analyzer()}`;
		this._cleaned_entries = new Map<string, AstCacheEntryContract>();
		const temporary_write_paths = new Set<string>();
		this._temporary_files = new AstDiskCacheTemporaryFiles(
			this._file_io,
			this._boundary_failures,
			temporary_write_paths,
		);
		this._record_cleanup = new AstDiskCacheRecordCleanup(
			this._cache_directory,
			this._project_identity,
			this._file_io,
			this._boundary_failures,
			this._cleaned_entries,
		);
	}

	/** Responsibilities: _unused cache entry removal_. **/
	public clean_unused_records(): void {
		this._cleaned_entries.clear();
		if (!this._file_io.file(this._cache_directory).path_exists()) {
			return;
		}
		for (const entry of this._file_io.list_files(this._cache_directory)) {
			const path = join(this._cache_directory, entry);
			if (entry.endsWith(".tmp")) {
				this._temporary_files.remove_abandoned(this._file_io.file(path), entry);
				continue;
			}
			if (!entry.endsWith(".json")) {
				continue;
			}
			this._record_cleanup.remove_unused_record(path);
		}
	}

	/** Responsibilities: _persistent AST content resolution_. **/
	public content(source_file: string, source_text: string): AstCacheEntryContract {
		const absolute_file = resolve(source_file);
		const source_hash = createHash("sha256").update(source_text).digest("hex");
		const path = this.cache_path(absolute_file, source_hash);
		const key = resolve(path);
		const cleaned_entry = this._cleaned_entries.get(key);
		if (cleaned_entry !== undefined) {
			this._cleaned_entries.delete(key);
			return cleaned_entry;
		}
		return this._record_cleanup.cache_entry(path, source_file, source_hash);
	}

	/** Responsibilities: _persistent AST storage_. **/
	public write(source_file: string, source_text: string, ast: NormalizedAstFile): void {
		try {
			const publication = this.prepare_record({ source_file, source_text, ast });
			this._file_io.create_directory(this._cache_directory);
			this._temporary_files.persist(publication.path, publication.record);
		} catch (error) {
			if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.System)) {
				throw error;
			}
		}
	}
}
