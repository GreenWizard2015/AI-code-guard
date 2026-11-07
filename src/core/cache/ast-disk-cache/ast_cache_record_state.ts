import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { AstCacheHit } from "src/core/cache/ast-disk-cache/ast_cache_hit";
import { AstCacheMemberShape } from "src/core/cache/ast-disk-cache/ast_cache_member_shape";
import { AstCacheMiss } from "src/core/cache/ast-disk-cache/ast_cache_miss";
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

	/** Responsibilities: _cache content hydration_. **/
	private cached_ast(): AstCacheEntryContract {
		const ast = this._record.ast;
		const type_members: AstTypeMembers = new Map(
			ast.references.type_members.map((group) => [
				group.name,
				new Map(group.members.map((member) => [member.name, member.type])),
			]),
		);
		return new AstCacheHit({
			source: ast.source,
			references: { ...ast.references, type_members },
			control_flow: ast.control_flow,
			module_declarations: ast.module_declarations,
		});
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
	private current(source_hash: string, requested_source_file: string): boolean {
		if (!this.identity_valid()) {
			return false;
		}
		if (resolve(this._record.source_file) !== resolve(requested_source_file)) {
			return false;
		}
		if (this._record.source_hash !== source_hash) {
			return false;
		}
		return resolve(this._cache_file) === resolve(this.expected_file());
	}

	/** Responsibilities: _record state initialization_. **/
	public constructor(cache_directory: string, cache_file: string, project_identity: string, record: AstCacheRecord) {
		this._cache_directory = cache_directory;
		this._cache_file = cache_file;
		this._project_identity = project_identity;
		this._record = record;
	}

	/** Responsibilities: _cached AST entry_. **/
	public entry(source_file: string, source_hash: string): AstCacheEntryContract {
		if (!this.current(source_hash, source_file)) {
			return new AstCacheMiss(source_file, "analysis cache identity changed");
		}
		const cached = this.cached_ast();
		if (!cached.complete()) {
			return new AstCacheMiss(source_file, "invalid normalized AST");
		}
		return cached;
	}

	/** Responsibilities: _source cache staleness_. **/
	public stale(file_io: IOContract): boolean {
		if (!this.shape_valid()) {
			return true;
		}
		const source_file = this._record.source_file;
		if (!file_io.file(source_file).path_exists()) {
			return true;
		}
		const source_text = file_io.file(source_file).file_text();
		const source_hash = createHash("sha256").update(source_text).digest("hex");
		if (!this.current(source_hash, source_file)) {
			return true;
		}
		const cached = this.cached_ast();
		return !cached.complete();
	}
}
