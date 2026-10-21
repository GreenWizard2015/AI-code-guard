import { createHash, randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import type { AstCacheAstContract } from "src/cache_types";
import { AI_CODE_GUARD_DIRECTORY, TYPESCRIPT_CACHE_OWNER } from "src/constants";
import { AstCacheHit } from "src/core/cache/ast_cache_hit";
import { AstCacheMemberShape } from "src/core/cache/ast_cache_member_shape";
import { AstCacheMiss } from "src/core/cache/ast_cache_miss";
import { AST_ANALYSIS_CACHE_VERSION, CACHE_DIRECTORY } from "src/core/constants";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";
import type { IOContract } from "src/io/protocols";
import type { AstCacheRecord } from "src/model/types/types";
import type { ProjectAnalysisIdentityContract } from "src/runtime_protocols";
import type { AstCacheEntryContract, AstDiskCacheContract } from "src/source_protocols";
import type { AstTypeMembers, AstTypeMembersSerialized, NormalizedAstFileContract } from "src/types";

/** Responsibilities: _AST cache storage_, _source freshness_. **/
export class AstDiskCache implements AstDiskCacheContract {
	private readonly cache_directory: string;
	private readonly project_identity: string;
	private readonly analysis_identity: ProjectAnalysisIdentityContract;
	private readonly file_io: IOContract;
	private readonly boundary_failures: BoundaryFailureClassifier;

	/** Responsibilities: _cache record shape_. **/
	private record_shape(record: AstCacheRecord): boolean {
		if (record === null || Array.isArray(record)) {
			return false;
		}
		if (String(record.source_file) !== record.source_file || String(record.source_hash) !== record.source_hash) {
			return false;
		}
		if (String(record.project_identity) !== record.project_identity) {
			return false;
		}
		if (!Number.isFinite(record.cache_version)) {
			return false;
		}
		if (record.source_file.length === 0 || record.source_hash.length === 0) {
			return false;
		}
		const member_shape = new AstCacheMemberShape(record);
		return member_shape.record_valid();
	}

	/** Responsibilities: _cached AST hydration_. **/
	private cached_ast(record: AstCacheRecord): AstCacheEntryContract {
		return new AstCacheHit({
			...record.ast,
			type_members: new Map(
				record.ast.type_members.map((group) => [
					group.name,
					new Map(group.members.map((member) => [member.name, member.type])),
				]),
			),
		});
	}

	/** Responsibilities: _type-member metadata serialization_. **/
	private serialized_type_members(members: AstTypeMembers): AstTypeMembersSerialized {
		return Array.from(members, ([name, record]) => ({
			name,
			members: Array.from(record, ([member_name, type]) => ({ name: member_name, type })),
		}));
	}

	/** Responsibilities: _AST serialization_. **/
	private serialized_ast(ast: NormalizedAstFileContract): AstCacheAstContract {
		return {
			language: ast.language,
			classes: ast.classes,
			functions: ast.functions,
			parse_issues: ast.parse_issues,
			import_issues: ast.import_issues,
			attribute_accesses: ast.attribute_accesses,
			symbol_references: ast.symbol_references,
			literal_references: ast.literal_references,
			literal_constants: ast.literal_constants,
			named_symbols: ast.named_symbols,
			type_declarations: ast.type_declarations,
			reference_aliases: ast.reference_aliases,
			private_accesses: ast.private_accesses,
			repeated_branches: ast.repeated_branches,
			call_references: ast.call_references,
			module_instances: ast.module_instances,
			module_constant_spans: ast.module_constant_spans,
			module_type_spans: ast.module_type_spans,
			module_protocol_spans: ast.module_protocol_spans,
			type_members: this.serialized_type_members(ast.type_members),
			coding_issues: ast.coding_issues,
			python_imports: ast.python_imports,
			python_callable_count: ast.python_callable_count,
			python_main_guard: ast.python_main_guard,
			docstring_spans: ast.docstring_spans,
			responsibility_targets: ast.responsibility_targets,
		};
	}

	/** Responsibilities: _cache filename hash construction_. **/
	private cache_path(absolute_file: string, source_hash: string): string {
		const key = createHash("sha256")
			.update(`${AST_ANALYSIS_CACHE_VERSION}\u0000${this.project_identity}\u0000${absolute_file}\u0000${source_hash}`)
			.digest("hex");
		return join(this.cache_directory, `${key}.json`);
	}

	/** Responsibilities: _cache record identity_. **/
	private cache_identity_valid(record: AstCacheRecord): boolean {
		if (!this.record_shape(record)) {
			return false;
		}
		if (record.cache_version !== AST_ANALYSIS_CACHE_VERSION) {
			return false;
		}
		return record.project_identity === this.project_identity;
	}

	/** Responsibilities: _cache record freshness_. **/
	private current_record(
		file: string,
		record: AstCacheRecord,
		source_file_hash: string,
		requested_source_file: string,
	): boolean {
		if (!this.cache_identity_valid(record)) {
			return false;
		}
		const record_source_file = resolve(record.source_file);
		if (record_source_file !== resolve(requested_source_file)) {
			return false;
		}
		if (source_file_hash !== record.source_hash) {
			return false;
		}
		const expected_path = resolve(this.cache_path(record_source_file, source_file_hash));
		return resolve(file) === expected_path;
	}

	/** Responsibilities: _source-backed cache freshness_. **/
	private source_record_stale(file: string, record: AstCacheRecord): boolean {
		if (!this.file_io.file_paths.path_exists(record.source_file)) {
			return true;
		}
		const source_hash = createHash("sha256")
			.update(this.file_io.file_content.file_text(record.source_file))
			.digest("hex");
		return !this.current_record(file, record, source_hash, record.source_file);
	}

	/** Responsibilities: _unused cache record detection_. **/
	private stale_record(file: string): boolean {
		try {
			const record: AstCacheRecord = JSON.parse(this.file_io.file_content.file_text(file));
			if (!this.record_shape(record)) {
				return true;
			}
			if (this.source_record_stale(file, record)) {
				return true;
			}
			return !this.cached_ast(record).complete();
		} catch (error) {
			if (!this.boundary_failures.cache_read_failure(String(error))) {
				throw error;
			}
			return true;
		}
	}

	/** Responsibilities: _unused cache record deletion_. **/
	private remove_unused_record(file: string): void {
		if (!this.file_io.file_paths.path_exists(file)) {
			return;
		}
		if (this.stale_record(file)) {
			try {
				this.file_io.file_operations.remove_file(file);
			} catch (error) {
				if (!this.boundary_failures.system_failure_message(String(error))) {
					throw error;
				}
			}
		}
	}

	/** Responsibilities: _cached AST entry construction_. **/
	private cached_entry(
		source_file: string,
		path: string,
		record: AstCacheRecord,
		source_file_hash: string,
	): AstCacheEntryContract {
		if (!this.current_record(path, record, source_file_hash, source_file)) {
			return new AstCacheMiss(source_file, "analysis cache identity changed");
		}
		const cached = this.cached_ast(record);
		if (!cached.complete()) {
			return new AstCacheMiss(source_file, "invalid normalized AST");
		}
		return cached;
	}

	/** Responsibilities: _cache record construction_. **/
	private cache_record(source_file: string, source_text: string, ast: NormalizedAstFileContract): AstCacheRecord {
		const absolute_file = resolve(source_file);
		const source_hash = createHash("sha256").update(source_text).digest("hex");
		return {
			cache_version: AST_ANALYSIS_CACHE_VERSION,
			project_identity: this.project_identity,
			source_file: absolute_file,
			source_hash,
			ast: this.serialized_ast(ast),
		};
	}

	/** Responsibilities: _failed atomic-write temporary cleanup_. **/
	private clean_temporary_record(path: string): void {
		if (!this.file_io.file_paths.path_exists(path)) {
			return;
		}
		try {
			this.file_io.file_operations.remove_file(path);
		} catch (error) {
			if (!this.boundary_failures.system_failure_message(String(error))) {
				throw error;
			}
		}
	}

	/** Responsibilities: _atomic cache record persistence_. **/
	private persist_record(path: string, record: AstCacheRecord): void {
		const temporary_path = `${path}.${process.pid}.${randomUUID()}.tmp`;
		const serialized = JSON.stringify(record);
		try {
			this.file_io.file_content.write_text(temporary_path, serialized);
			this.file_io.file_operations.move_file(temporary_path, path);
		} finally {
			this.clean_temporary_record(temporary_path);
		}
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
		this.cache_directory = join(
			resolve(repo_root),
			AI_CODE_GUARD_DIRECTORY,
			CACHE_DIRECTORY,
			"ast",
			resolved_cache_owner,
		);
		this.analysis_identity = analysis_identity;
		this.file_io = file_io;
		this.boundary_failures = new BoundaryFailureClassifier();
		this.project_identity = `${project_identity}\u0000${this.analysis_identity.analyzer()}`;
	}

	/** Responsibilities: _unused cache entry removal_. **/
	public clean_unused_records(): void {
		if (!this.file_io.file_paths.path_exists(this.cache_directory)) {
			return;
		}
		for (const entry of this.file_io.directory_entries.list_files(this.cache_directory)) {
			if (!entry.endsWith(".json")) {
				continue;
			}
			this.remove_unused_record(join(this.cache_directory, entry));
		}
	}

	/** Responsibilities: _persistent AST content resolution_. **/
	public content(source_file: string, source_text: string): AstCacheEntryContract {
		try {
			const absolute_file = resolve(source_file);
			const source_file_hash = createHash("sha256").update(source_text).digest("hex");
			const path = this.cache_path(absolute_file, source_file_hash);
			const record: AstCacheRecord = JSON.parse(this.file_io.file_content.file_text(path));
			if (!this.record_shape(record)) {
				return new AstCacheMiss(source_file, "invalid cache record");
			}
			return this.cached_entry(source_file, path, record, source_file_hash);
		} catch (error) {
			if (!this.boundary_failures.cache_read_failure(String(error))) {
				throw error;
			}
			return new AstCacheMiss(source_file, "cache file unavailable");
		}
	}

	/** Responsibilities: _persistent AST storage_. **/
	public write(source_file: string, source_text: string, ast: NormalizedAstFileContract): void {
		try {
			const absolute_file = resolve(source_file);
			const source_hash = createHash("sha256").update(source_text).digest("hex");
			const path = this.cache_path(absolute_file, source_hash);
			this.file_io.directory_operations.create_directory(this.cache_directory);
			this.persist_record(path, this.cache_record(source_file, source_text, ast));
		} catch (error) {
			if (!this.boundary_failures.system_failure_message(String(error))) {
				throw error;
			}
		}
	}
}
