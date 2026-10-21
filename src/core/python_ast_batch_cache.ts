import { AstCacheHit } from "src/core/cache/ast_cache_hit";
import { AstCacheMiss } from "src/core/cache/ast_cache_miss";
import { AstDiskCache } from "src/core/cache/ast_disk_cache";
import type { AstCacheEntryContract, AstDiskCacheContract } from "src/source_protocols";
import type { ProjectAnalysisIdentityContract } from "src/runtime_protocols";
import type { PythonAstBatchCacheContract } from "src/python_protocols";
import type { PythonAstBatchParser } from "src/python_types";
import type {
	NormalizedAstFileContract,
	PythonAstCacheBatch,
	PythonAstCacheReadOptions,
	PythonAstCacheWriteOptions,
	PythonBatchAstOptions,
} from "src/types";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _in-memory AST lookup_, _persistent batch cache coordination_. **/
export class PythonAstBatchCache implements PythonAstBatchCacheContract {
	private readonly parsed_ast_cache: Map<string, NormalizedAstFileContract>;
	private readonly disk_cache_enabled: boolean;
	private readonly analysis_identity: ProjectAnalysisIdentityContract;
	private readonly file_io: IOContract;

	/** Responsibilities: _cached batch result collection_. **/
	private cached_batch_results(texts: readonly string[]): Map<number, NormalizedAstFileContract> {
		const results = new Map<number, NormalizedAstFileContract>();
		for (const [index, text] of texts.entries()) {
			const ast = this.parsed_ast_cache.get(text);
			if (ast !== undefined) {
				results.set(index, ast);
			}
		}
		return results;
	}

	/** Responsibilities: _persistent AST cache retrieval_. **/
	private read_disk_results(options: PythonAstCacheReadOptions): void {
		const empty_repo_root = options.repo_root.length === 0;
		if (!this.disk_cache_enabled || empty_repo_root) {
			return;
		}
		const disk_cache = new AstDiskCache(options.repo_root, "", this.analysis_identity, "python", this.file_io);
		disk_cache.clean_unused_records();
		options.stage_timer.measure(`${options.stage_prefix}.disk-cache-read`, () => {
			for (const [index, file] of options.files.entries()) {
				this.read_disk_result(options, disk_cache, index, file);
			}
		});
	}

	/** Responsibilities: _AST cache entry retrieval_. **/
	private read_disk_result(
		options: PythonAstCacheReadOptions,
		disk_cache: AstDiskCacheContract,
		index: number,
		file: string,
	): void {
		if (options.results.has(index)) {
			return;
		}
		const text = options.texts[index];
		if (text === undefined) {
			return;
		}
		const cached = disk_cache.content(file, text);
		if (cached.should_reparse()) {
			return;
		}
		const ast = cached.value();
		this.parsed_ast_cache.set(text, ast);
		options.results.set(index, ast);
	}

	/** Responsibilities: _missing batch index lookup_. **/
	private missing_batch_indexes(texts: readonly string[], results: ReadonlyMap<number, NormalizedAstFileContract>): number[] {
		const indexes: number[] = [];
		for (const index of texts.keys()) {
			if (!results.has(index)) {
				indexes.push(index);
			}
		}
		return indexes;
	}

	/** Responsibilities: _uncached source validation_. **/
	private missing_batch_texts(texts: readonly string[], indexes: readonly number[]): string[] {
		return indexes.map((index) => {
			const negative_index = index < 0;
			const past_end = index >= texts.length;
			if (negative_index || past_end) {
				throw new Error("Python AST batch source is missing.");
			}
			return texts[index];
		});
	}

	/** Responsibilities: _parsed batch result storage_. **/
	private store_batch_results(
		texts: readonly string[],
		indexes: readonly number[],
		parsed: readonly NormalizedAstFileContract[],
		results: Map<number, NormalizedAstFileContract>,
	): void {
		for (const [index, text_index] of indexes.entries()) {
			const text_valid = text_index >= 0 && text_index < texts.length;
			const ast_valid = index >= 0 && index < parsed.length;
			if (!text_valid || !ast_valid) {
				throw new Error("Python AST bridge returned an incomplete batch.");
			}
			const text = texts[text_index];
			const ast = parsed[index];
			this.parsed_ast_cache.set(text, ast);
			results.set(text_index, ast);
		}
	}

	/** Responsibilities: _ordered batch result completion_. **/
	private complete_batch(
		texts: readonly string[],
		results: ReadonlyMap<number, NormalizedAstFileContract>,
	): NormalizedAstFileContract[] {
		return texts.map((_, index) => {
			const ast = results.get(index);
			if (ast === undefined) {
				throw new Error("Python AST batch result is missing.");
			}
			return ast;
		});
	}

	/** Responsibilities: _persistent AST cache storage_. **/
	private write_disk_results(options: PythonAstCacheWriteOptions): void {
		const empty_repo_root = options.repo_root.length === 0;
		if (!this.disk_cache_enabled || empty_repo_root) {
			return;
		}
		const disk_cache = new AstDiskCache(options.repo_root, "", this.analysis_identity, "python", this.file_io);
		disk_cache.clean_unused_records();
		options.stage_timer.measure(`${options.stage_prefix}.disk-cache-write`, () => {
			for (const [index, text_index] of options.indexes.entries()) {
				this.write_disk_result(options, disk_cache, index, text_index);
			}
		});
	}

	/** Responsibilities: _AST cache entry persistence_. **/
	private write_disk_result(
		options: PythonAstCacheWriteOptions,
		disk_cache: AstDiskCacheContract,
		index: number,
		text_index: number,
	): void {
		const file = options.files[text_index];
		const ast = options.parsed[index];
		const missing_file = file === undefined;
		const missing_ast = ast === undefined;
		const missing_text = options.texts[text_index] === undefined;
		if (missing_file || missing_ast || missing_text) {
			return;
		}
		const source_text = options.texts[text_index];
		if (source_text === undefined) {
			return;
		}
		disk_cache.write(file, source_text, ast);
	}

	/** Responsibilities: _batch cache setup_. **/
	public constructor(
		parsed_ast_cache: Map<string, NormalizedAstFileContract>,
		disk_cache_enabled: boolean,
		analysis_identity: ProjectAnalysisIdentityContract,
		file_io: IOContract,
	) {
		this.parsed_ast_cache = parsed_ast_cache;
		this.disk_cache_enabled = disk_cache_enabled;
		this.analysis_identity = analysis_identity;
		this.file_io = file_io;
	}

	/** Responsibilities: _memory AST cache state_. **/
	public cached(text: string): AstCacheEntryContract {
		const ast = this.parsed_ast_cache.get(text);
		if (ast === undefined) {
			return new AstCacheMiss(text, "memory cache miss");
		}
		return new AstCacheHit(ast);
	}

	/** Responsibilities: _Python AST cache state_. **/
	public prepare(options: PythonBatchAstOptions): PythonAstCacheBatch {
		const results = this.cached_batch_results(options.texts);
		this.read_disk_results({ ...options, results });
		const missing_indexes = this.missing_batch_indexes(options.texts, results);
		return {
			options,
			cache: {
				results,
				missing_indexes,
				missing_texts: this.missing_batch_texts(options.texts, missing_indexes),
			},
		};
	}

	/** Responsibilities: _Python AST cache results_. **/
	public complete(batch: PythonAstCacheBatch, parsed: readonly NormalizedAstFileContract[]): NormalizedAstFileContract[] {
		const { options, cache } = batch;
		this.store_batch_results(options.texts, cache.missing_indexes, parsed, cache.results);
		this.write_disk_results({
			...options,
			indexes: cache.missing_indexes,
			parsed,
		});
		return this.complete_batch(options.texts, cache.results);
	}

	/** Responsibilities: _batch AST resolution_. **/
	public resolve(options: PythonBatchAstOptions, parse: PythonAstBatchParser): NormalizedAstFileContract[] {
		const preparation = this.prepare(options);
		const parsed = parse(preparation.cache.missing_texts);
		return this.complete(preparation, parsed);
	}
}
