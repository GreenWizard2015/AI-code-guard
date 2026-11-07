import { AstCacheHit } from "src/core/cache/ast-disk-cache/ast_cache_hit";
import { AstCacheMiss } from "src/core/cache/ast-disk-cache/ast_cache_miss";
import { AstDiskCache } from "src/core/cache/ast-disk-cache/ast_disk_cache";
import {
	PYTHON_AST_INCOMPLETE_CACHE_BATCH_MESSAGE,
	PYTHON_AST_MISSING_BATCH_RESULT_MESSAGE,
	PYTHON_AST_MISSING_BATCH_SOURCE_MESSAGE,
} from "src/core/python-ast/constants";
import type { IOContract } from "src/io/protocols";
import type {
	NormalizedAstFile,
	PythonAstCacheBatch,
	PythonAstCacheReadOptions,
	PythonAstCacheWriteOptions,
	PythonBatchAstOptions,
} from "src/model/ast/normalized_ast_types";
import type { PythonAstBatchCacheContract } from "src/python_protocols";
import type { CallablePythonAstBatchParser } from "src/python_types";
import type { ProjectAnalysisIdentityContract } from "src/runtime_protocols";
import type { AstCacheEntryContract, AstDiskCacheContract } from "src/source_protocols";

/** Responsibilities: _in-memory AST lookup_, _persistent batch cache coordination_. **/
export class PythonAstBatchCache implements PythonAstBatchCacheContract {
	private readonly _parsed_ast_cache: Map<string, NormalizedAstFile>;
	private readonly _disk_cache_enabled: boolean;
	private readonly _analysis_identity: ProjectAnalysisIdentityContract;
	private readonly _file_io: IOContract;

	/** Responsibilities: _persistent AST cache retrieval_. **/
	private read_disk_results(options: PythonAstCacheReadOptions): void {
		const empty_repo_root = options.repo_root.length === 0;
		if (!this._disk_cache_enabled || empty_repo_root) {
			return;
		}
		const disk_cache = new AstDiskCache(options.repo_root, "", this._analysis_identity, "python", this._file_io);
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
		this._parsed_ast_cache.set(text, ast);
		options.results.set(index, ast);
	}

	/** Responsibilities: _parsed batch result storage_. **/
	private store_batch_results(
		texts: readonly string[],
		indexes: readonly number[],
		parsed: readonly NormalizedAstFile[],
		results: Map<number, NormalizedAstFile>,
	): void {
		for (const [index, text_index] of indexes.entries()) {
			const text_valid = text_index >= 0 && text_index < texts.length;
			const ast_valid = index >= 0 && index < parsed.length;
			const text = texts[text_index];
			const ast = parsed[index];
			const indexes_valid = text_valid && ast_valid;
			const values_present = text !== undefined && ast !== undefined;
			if (!indexes_valid || !values_present) {
				throw new Error(PYTHON_AST_INCOMPLETE_CACHE_BATCH_MESSAGE);
			}
			this._parsed_ast_cache.set(text, ast);
			results.set(text_index, ast);
		}
	}

	/** Responsibilities: _persistent AST cache storage_. **/
	private write_disk_results(options: PythonAstCacheWriteOptions): void {
		const empty_repo_root = options.repo_root.length === 0;
		if (!this._disk_cache_enabled || empty_repo_root) {
			return;
		}
		const disk_cache = new AstDiskCache(options.repo_root, "", this._analysis_identity, "python", this._file_io);
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
		const source_text = options.texts[text_index];
		if (missing_file || missing_ast || source_text === undefined) {
			return;
		}
		disk_cache.write(file, source_text, ast);
	}

	/** Responsibilities: _in-memory batch lookup_. **/
	private memory_results(batch_texts: readonly string[]): Map<number, NormalizedAstFile> {
		const results = new Map<number, NormalizedAstFile>();
		for (const [index, text] of batch_texts.entries()) {
			const ast = this._parsed_ast_cache.get(text);
			if (ast !== undefined) {
				results.set(index, ast);
			}
		}
		return results;
	}

	/** Responsibilities: _missing AST batch indexes_. **/
	private missing_indexes(texts: readonly string[], results: ReadonlyMap<number, NormalizedAstFile>): number[] {
		const missing: number[] = [];
		for (const index of texts.keys()) {
			if (!results.has(index)) {
				missing.push(index);
			}
		}
		return missing;
	}

	/** Responsibilities: _batch source text selection_. **/
	private missing_texts(source_texts: readonly string[], indexes: readonly number[]): string[] {
		return indexes.map((index) => {
			const source_text = source_texts[index];
			const invalid_index = index < 0 || index >= source_texts.length;
			if (invalid_index || source_text === undefined) {
				throw new Error(PYTHON_AST_MISSING_BATCH_SOURCE_MESSAGE);
			}
			return source_text;
		});
	}

	/** Responsibilities: _batch cache setup_. **/
	public constructor(
		parsed_ast_cache: Map<string, NormalizedAstFile>,
		disk_cache_enabled: boolean,
		analysis_identity: ProjectAnalysisIdentityContract,
		file_io: IOContract,
	) {
		this._parsed_ast_cache = parsed_ast_cache;
		this._disk_cache_enabled = disk_cache_enabled;
		this._analysis_identity = analysis_identity;
		this._file_io = file_io;
	}

	/** Responsibilities: _memory AST cache state_. **/
	public cached(text: string): AstCacheEntryContract {
		const ast = this._parsed_ast_cache.get(text);
		if (ast === undefined) {
			return new AstCacheMiss(text, "memory cache miss");
		}
		return new AstCacheHit(ast);
	}

	/** Responsibilities: _Python AST cache state_. **/
	public prepare(options: PythonBatchAstOptions): PythonAstCacheBatch {
		const results = this.memory_results(options.texts);
		this.read_disk_results({ ...options, results });
		const missing_indexes = this.missing_indexes(options.texts, results);
		const missing_texts = this.missing_texts(options.texts, missing_indexes);
		return {
			options,
			cache: {
				results,
				missing_indexes,
				missing_texts,
			},
		};
	}

	/** Responsibilities: _Python AST cache results_. **/
	public complete(batch: PythonAstCacheBatch, parsed: readonly NormalizedAstFile[]): NormalizedAstFile[] {
		const { options, cache } = batch;
		this.store_batch_results(options.texts, cache.missing_indexes, parsed, cache.results);
		this.write_disk_results({
			...options,
			indexes: cache.missing_indexes,
			parsed,
		});
		return options.texts.map((_, index) => {
			const ast = cache.results.get(index);
			if (ast === undefined) {
				throw new Error(PYTHON_AST_MISSING_BATCH_RESULT_MESSAGE);
			}
			return ast;
		});
	}

	/** Responsibilities: _batch AST resolution_. **/
	public resolve(options: PythonBatchAstOptions, parse: CallablePythonAstBatchParser): NormalizedAstFile[] {
		const preparation = this.prepare(options);
		const parsed = parse(preparation.cache.missing_texts);
		return this.complete(preparation, parsed);
	}
}
