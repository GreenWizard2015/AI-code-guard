import { randomUUID } from 'node:crypto';
import { AstModel } from 'src/bridge/ts/core/ast-model';
import { PythonAstBridge } from 'src/bridge/ts/core/python-ast-bridge';
import { PythonAstWorker } from 'src/bridge/ts/core/python-ast-worker.mjs';
import type { NormalizedAstFile } from 'src/types';

/** Responsibilities: _cache Python AST batches_. **/
export class PythonAstData {
	private readonly parsed_ast_cache = new Map<string, NormalizedAstFile>();
	private readonly ast_model = new AstModel();
	private readonly worker: PythonAstWorker;

	/** Responsibilities: _Python results validation_. **/
	private validate_bridge_output(parsed: NormalizedAstFile): void {
		if (parsed.language !== 'python') {
			throw new Error('Python AST bridge returned an unexpected language.');
		}
	}

	/** Responsibilities: _cached batch results collection_. **/
	private cached_batch_results(
		texts: readonly string[]
	): Map<number, NormalizedAstFile> {
		const results = new Map<number, NormalizedAstFile>();
		for (const [index, text] of texts.entries()) {
			const ast = this.parsed_ast_cache.get(text);
			if (ast !== undefined) {
				results.set(index, ast);
			}
		}
		return results;
	}

	/** Responsibilities: _missing batch positions lookup_. **/
	private missing_batch_indexes(
		texts: readonly string[],
		results: ReadonlyMap<number, NormalizedAstFile>
	): number[] {
		const indexes: number[] = [];
		for (const index of texts.keys()) {
			if (!results.has(index)) {
				indexes.push(index);
			}
		}
		return indexes;
	}

	/** Responsibilities: _uncached sources validation_. **/
	private missing_batch_texts(texts: readonly string[], indexes: readonly number[]): string[] {
		return indexes.map(index => {
			if (index < 0 || index >= texts.length) {
				throw new Error('Python AST batch source is missing.');
			}
			return texts[index];
		});
	}

	/** Responsibilities: _cache parsed results_. **/
	private store_batch_results(
		texts: readonly string[],
		indexes: readonly number[],
		parsed: readonly NormalizedAstFile[],
		results: Map<number, NormalizedAstFile>
	): void {
		for (const [index, text_index] of indexes.entries()) {
			const text_in_range = text_index >= 0 && text_index < texts.length;
			const ast_in_range = index >= 0 && index < parsed.length;
			if (!text_in_range || !ast_in_range) {
				throw new Error('Python AST bridge returned an incomplete batch.');
			}
			const text = texts[text_index];
			const ast = parsed[index];
			this.parsed_ast_cache.set(text, ast);
			results.set(text_index, ast);
		}
	}

	/** Responsibilities: _rebuild ordered results_. **/
	private complete_batch(
		texts: readonly string[],
		results: ReadonlyMap<number, NormalizedAstFile>
	): NormalizedAstFile[] {
		const values = Array.from(results.values());
		return texts.map((_, index) => {
			if (index < 0 || index >= values.length) {
				throw new Error('Python AST batch result is missing.');
			}
			return values[index];
		});
	}

	/** Responsibilities: _encode batch sources_. **/
	private source_map(texts: readonly string[]): Record<string, string> {
		const sources: Record<string, string> = {};
		for (const [index, text] of texts.entries()) {
			sources[String(index)] = text;
		}
		return sources;
	}

	/** Responsibilities: _worker batch validation_. **/
	private worker_batch_results(
		batch_id: string,
		texts: readonly string[]
	): NormalizedAstFile[] {
		const response = this.worker.batch_result(batch_id, this.source_map(texts));
		if (response.batchId !== batch_id) {
			throw new Error('Python AST worker returned an unexpected batch id.');
		}
		return texts.map((_, index) => {
			const name = String(index);
			if (!(name in response.asts)) {
				throw new Error('Python AST worker returned an incomplete batch.');
			}
			const parsed = response.asts[name];
			this.validate_bridge_output(parsed);
			return parsed;
		});
	}

	/** Responsibilities: _nonempty batches parsing_. **/
	private parse_bridge_batch(texts: readonly string[]): NormalizedAstFile[] {
		if (texts.length === 0) {
			return [];
		}
		return this.worker_batch_results(randomUUID(), texts);
	}

	/** Responsibilities: _bridge workers initialization_. **/
	public constructor(...workers: PythonAstWorker[]) {
		if (workers.length === 0) {
			const bridge = new PythonAstBridge();
			this.worker = new PythonAstWorker(bridge.worker_arguments(), bridge.worker_options(), false);
		} else {
			this.worker = workers[0];
		}
	}

	/** Responsibilities: _Python batches parsing_. **/
	public batch_ast(texts: readonly string[]): NormalizedAstFile[] {
		const results = this.cached_batch_results(texts);
		const missing_indexes = this.missing_batch_indexes(texts, results);
		const parsed = this.parse_bridge_batch(this.missing_batch_texts(texts, missing_indexes));
		this.store_batch_results(texts, missing_indexes, parsed, results);
		return this.complete_batch(texts, results);
	}

	/** Responsibilities: _retrieve cached ASTs_. **/
	public source_ast(text: string): NormalizedAstFile {
		const cached = this.parsed_ast_cache.get(text);
		if (cached) {
			return cached;
		}
		if (text.length === 0) {
			const empty = this.ast_model.empty_ast_file('python');
			this.parsed_ast_cache.set(text, empty);
			return empty;
		}
		const parsed = this.batch_ast([text])[0];
		this.parsed_ast_cache.set(text, parsed);
		return parsed;
	}

}
