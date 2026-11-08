import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { AstCacheHit } from "src/core/cache/ast-disk-cache/ast_cache_hit";
import { AstCacheMemberShape } from "src/core/cache/ast-disk-cache/ast_cache_member_shape";
import { AstCacheMiss } from "src/core/cache/ast-disk-cache/ast_cache_miss";
import type { AstCacheSourceIdentity } from "src/core/cache/ast-disk-cache/types";
import { AST_ANALYSIS_CACHE_VERSION } from "src/core/constants";
import type { IOContract } from "src/io/protocols";
import type { AstTypeMembers } from "src/model/ast/normalized_ast_types";
import type { AstCacheRecord } from "src/model_types";
import type { AstCacheEntryContract } from "src/source_protocols";

/** Responsibilities: _AST cache record state_, _source identity validation_. **/
export class AstCacheRecordState {
	private readonly _cache_directory: string;
	private readonly _cache_file: string;
	private readonly _project_identity: string;
	private readonly _record: AstCacheRecord;

	/** Responsibilities: _cache source fields_. **/
	private source_fields_valid(): boolean {
		if (typeof this._record.source_file !== "string") {
			return false;
		}
		if (typeof this._record.source_hash !== "string") {
			return false;
		}
		if (typeof this._record.project_identity !== "string") {
			return false;
		}
		if (!Number.isFinite(this._record.cache_version)) {
			return false;
		}
		return this._record.source_file.length > 0 && this._record.source_hash.length > 0;
	}

	/** Responsibilities: _cache record shape_. **/
	private shape_valid(): boolean {
		if (this._record === null) {
			return false;
		}
		if (Array.isArray(this._record)) {
			return false;
		}
		if (!this.source_fields_valid()) {
			return false;
		}
		const member_shape = new AstCacheMemberShape(this._record);
		return member_shape.record_valid();
	}

	/** Responsibilities: _cached AST hydration_. **/
	private cached_ast(source_file: string): AstCacheEntryContract {
		const ast = this._record.ast;
		const type_members: AstTypeMembers = new Map(
			ast.references.type_members.map((group) => [
				group.name,
				new Map(group.members.map((member) => [member.name, member.type])),
			]),
		);
		const cached = new AstCacheHit({
			source: ast.source,
			references: { ...ast.references, type_members },
			control_flow: ast.control_flow,
			module_declarations: ast.module_declarations,
		});
		if (!cached.complete()) {
			return new AstCacheMiss(source_file, "invalid normalized AST");
		}
		return cached;
	}

	/** Responsibilities: _cache identity validation_. **/
	private identity_valid(): boolean {
		if (!this.shape_valid() || this._record.cache_version !== AST_ANALYSIS_CACHE_VERSION) {
			return false;
		}
		return this._record.project_identity === this._project_identity;
	}

	/** Responsibilities: _cache file identity_. **/
	private expected_file(): string {
		const source_file = resolve(this._record.source_file);
		const key = createHash("sha256")
			.update(
				`${AST_ANALYSIS_CACHE_VERSION}\u0000${this._project_identity}\u0000${source_file}\u0000${this._record.source_hash}`,
			)
			.digest("hex");
		return join(this._cache_directory, `${key}.json`);
	}

	/** Responsibilities: _source cache freshness_. **/
	private current(identity: AstCacheSourceIdentity): boolean {
		if (!this.identity_valid()) {
			return false;
		}
		if (resolve(this._record.source_file) !== resolve(identity.source_file)) {
			return false;
		}
		if (this._record.source_hash !== identity.source_hash) {
			return false;
		}
		return resolve(this._cache_file) === resolve(this.expected_file());
	}

	/** Responsibilities: _source cache entry validation_. **/
	private source_entry(file_io: IOContract, record_source_file: string): AstCacheEntryContract {
		const source = file_io.file(record_source_file);
		if (!source.path_exists()) {
			return new AstCacheMiss(record_source_file, "source file is missing");
		}
		const source_hash = createHash("sha256").update(source.file_text()).digest("hex");
		if (!this.current({ source_file: record_source_file, source_hash })) {
			return new AstCacheMiss(record_source_file, "cache identity changed");
		}
		return this.cached_ast(record_source_file);
	}

	/** Responsibilities: _record state initialization_. **/
	public constructor(cache_directory: string, cache_file: string, project_identity: string, record: AstCacheRecord) {
		this._cache_directory = cache_directory;
		this._cache_file = cache_file;
		this._project_identity = project_identity;
		this._record = record;
	}

	/** Responsibilities: _cached AST entry_. **/
	public entry(identity: AstCacheSourceIdentity): AstCacheEntryContract {
		if (!this.current(identity)) {
			return new AstCacheMiss(identity.source_file, "analysis cache identity changed");
		}
		return this.cached_ast(identity.source_file);
	}

	/** Responsibilities: _cache entry validation_. **/
	public validated_entry(file_io: IOContract): AstCacheEntryContract {
		if (!this.shape_valid()) {
			return new AstCacheMiss(this._cache_file, "invalid cache record");
		}
		const source_file = this._record.source_file;
		return this.source_entry(file_io, source_file);
	}
}
