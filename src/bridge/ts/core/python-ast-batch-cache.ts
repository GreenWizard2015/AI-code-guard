import { AstCacheHit } from "src/bridge/ts/core/support/ast-cache-hit";
import { AstCacheMiss } from "src/bridge/ts/core/support/ast-cache-miss";
import { AstDiskCache } from "src/bridge/ts/core/support/ast-disk-cache";
import type { AstCacheEntry } from "src/bridge/ts/core/support/protocols";
import type { PythonAstBatchParser } from "src/protocols";
import type {
	NormalizedAstFile,
	PythonAstCacheReadOptions,
	PythonAstCacheWriteOptions,
	PythonBatchAstOptions,
} from "src/types";

/** Responsibilities: _Python AST caching_. **/
export class PythonAstBatchCache {
	private readonly parsed_ast_cache: Map<string, NormalizedAstFile>;
	private readonly disk_cache_enabled: boolean;

	/** Responsibilities: _cached batch result collection_. **/
	private cached_batch_results(texts: readonly string[]): Map<number, NormalizedAstFile> {
		const results = new Map<number, NormalizedAstFile>();
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
		const disk_cache = new AstDiskCache(options.repo_root);
		options.stage_timer.measure(`${options.stage_prefix}.disk-cache-read`, () => {
			for (const [index, file] of options.files.entries()) {
				this.read_disk_result(options, disk_cache, index, file);
			}
		});
	}

	/** Responsibilities: _AST cache entry retrieval_. **/
	private read_disk_result(
		options: PythonAstCacheReadOptions,
		disk_cache: AstDiskCache,
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
		const cached = disk_cache.content(file);
		if (cached.should_reparse()) {
			return;
		}
		const ast = cached.value();
		this.parsed_ast_cache.set(text, ast);
		options.results.set(index, ast);
	}

	/** Responsibilities: _missing batch index lookup_. **/
	private missing_batch_indexes(texts: readonly string[], results: ReadonlyMap<number, NormalizedAstFile>): number[] {
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
		parsed: readonly NormalizedAstFile[],
		results: Map<number, NormalizedAstFile>,
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
		results: ReadonlyMap<number, NormalizedAstFile>,
	): NormalizedAstFile[] {
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
		const disk_cache = new AstDiskCache(options.repo_root);
		options.stage_timer.measure(`${options.stage_prefix}.disk-cache-write`, () => {
			for (const [index, text_index] of options.indexes.entries()) {
				this.write_disk_result(options, disk_cache, index, text_index);
			}
		});
	}

	/** Responsibilities: _AST cache entry persistence_. **/
	private write_disk_result(
		options: PythonAstCacheWriteOptions,
		disk_cache: AstDiskCache,
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
		disk_cache.write(file, ast);
	}

	/** Responsibilities: _batch cache setup_. **/
	public constructor(parsed_ast_cache: Map<string, NormalizedAstFile>, disk_cache_enabled: boolean) {
		this.parsed_ast_cache = parsed_ast_cache;
		this.disk_cache_enabled = disk_cache_enabled;
	}

	/** Responsibilities: _memory AST cache state_. **/
	public cached(text: string): AstCacheEntry {
		const ast = this.parsed_ast_cache.get(text);
		if (ast === undefined) {
			return new AstCacheMiss(text, "memory cache miss");
		}
		return new AstCacheHit(ast);
	}

	/** Responsibilities: _batch AST resolution_. **/
	public resolve(options: PythonBatchAstOptions, parse: PythonAstBatchParser): NormalizedAstFile[] {
		const results = this.cached_batch_results(options.texts);
		this.read_disk_results({ ...options, results });
		const missing_indexes = this.missing_batch_indexes(options.texts, results);
		const parsed = parse(this.missing_batch_texts(options.texts, missing_indexes));
		this.store_batch_results(options.texts, missing_indexes, parsed, results);
		this.write_disk_results({ ...options, indexes: missing_indexes, parsed });
		return this.complete_batch(options.texts, results);
	}
}
