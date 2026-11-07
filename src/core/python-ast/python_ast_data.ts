import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { AstModel } from "src/core/ast_model";
import {
	PYTHON_AST_EMPTY_SOURCE_RESULT_MESSAGE,
	PYTHON_AST_MISSING_SPLIT_BATCH_MESSAGE,
	PYTHON_AST_STAGE_PREFIX,
} from "src/core/python-ast/constants";
import { PythonAstBatchCache } from "src/core/python-ast/python_ast_batch_cache";
import { PythonAstBatchResult } from "src/core/python-ast/python_ast_batch_result";
import type { PythonAstBridgeOptions, PythonBatchAstPreparation } from "src/core/python-ast/types";
import { LintStageTimer } from "src/lint_stage_timer";
import type { NormalizedAstFile, PythonAstCacheBatch, PythonBatchAstOptions } from "src/model/ast/normalized_ast_types";
import type { PythonAstWorkerCapabilityContract } from "src/python_protocols";
import type { PythonAstDataContract } from "src/python_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { AstModelContract } from "src/source_protocols";

/** Responsibilities: _Python AST ownership_, _batch cache_, _worker state_. **/
export class PythonAstData implements PythonAstDataContract {
	private readonly _parsed_ast_cache: Map<string, NormalizedAstFile>;
	private readonly _batch_cache: PythonAstBatchCache;
	private readonly _ast_model: AstModelContract;
	private readonly _default_stage_timer: LintStageTimerContract;
	private readonly _worker: PythonAstWorkerCapabilityContract;
	private readonly _pending_batches: Map<string, PythonBatchAstPreparation>;
	private readonly _split_batch_enabled: boolean;

	/** Responsibilities: _Python snapshot retention_. **/
	private retain_snapshot_texts(snapshot_texts: readonly string[], project_scoped: boolean): void {
		if (!project_scoped) {
			return;
		}
		const active_texts = new Set(snapshot_texts);
		for (const pending of this._pending_batches.values()) {
			for (const text of pending.options.texts) {
				active_texts.add(text);
			}
		}
		for (const text of this._parsed_ast_cache.keys()) {
			if (!active_texts.has(text)) {
				this._parsed_ast_cache.delete(text);
			}
		}
	}

	/** Responsibilities: _encode batch sources_. **/
	private source_map(source_texts: readonly string[]): Map<string, string> {
		const sources = new Map<string, string>();
		for (const [index, text] of source_texts.entries()) {
			sources.set(String(index), text);
		}
		return sources;
	}

	/** Responsibilities: _worker batch validation_. **/
	private worker_batch_results(
		worker_batch_id: string,
		batch_texts: readonly string[],
		stage_timer: LintStageTimerContract,
		stage_prefix = "",
	): NormalizedAstFile[] {
		let resolved_stage_prefix = PYTHON_AST_STAGE_PREFIX;
		if (stage_prefix.length > 0) {
			resolved_stage_prefix = stage_prefix;
		}
		const sources = stage_timer.measure(`${resolved_stage_prefix}.batch-source-map`, () =>
			this.source_map(batch_texts),
		);
		const worker_batch = this._worker.batch(worker_batch_id, sources);
		const response = stage_timer.measure(`${resolved_stage_prefix}.bridge-round-trip`, () => worker_batch.result());
		const batch_result = new PythonAstBatchResult({
			batch_id: worker_batch_id,
			texts: batch_texts,
			response,
			stage_timer,
			stage_prefix: resolved_stage_prefix,
		});
		batch_result.record_timings();
		return stage_timer.measure(`${resolved_stage_prefix}.response-validation`, () => batch_result.validated_results());
	}

	/** Responsibilities: _split batch stage prefix_. **/
	private stage_prefix(stage_prefix: string): string {
		if (stage_prefix.length > 0) {
			return stage_prefix;
		}
		return PYTHON_AST_STAGE_PREFIX;
	}

	/** Responsibilities: _split batch request start_. **/
	private begin_worker_batch(batch: PythonAstCacheBatch): string {
		const options = batch.options;
		const batch_id = randomUUID();
		const prefix = this.stage_prefix(options.stage_prefix);
		const sources = options.stage_timer.measure(`${prefix}.batch-source-map`, () =>
			this.source_map(batch.cache.missing_texts),
		);
		const started_at = performance.now();
		const worker_batch = this._worker.batch(batch_id, sources);
		worker_batch.start();
		this._pending_batches.set(batch_id, {
			options: batch.options,
			cache: batch.cache,
			worker_batch,
			started_at,
		});
		return batch_id;
	}

	/** Responsibilities: _split batch result completion_. **/
	private complete_batch_results(preparation: PythonBatchAstPreparation, batch_id: string): NormalizedAstFile[] {
		const prefix = this.stage_prefix(preparation.options.stage_prefix);
		const response = preparation.worker_batch.complete();
		preparation.options.stage_timer.add_duration({
			name: `${prefix}.bridge-round-trip`,
			duration_ms: performance.now() - preparation.started_at,
		});
		const batch_result = new PythonAstBatchResult({
			batch_id,
			texts: preparation.cache.missing_texts,
			response,
			stage_timer: preparation.options.stage_timer,
			stage_prefix: prefix,
		});
		batch_result.record_timings();
		const parsed = preparation.options.stage_timer.measure(`${prefix}.response-validation`, () =>
			batch_result.validated_results(),
		);
		const results = this._batch_cache.complete({ options: preparation.options, cache: preparation.cache }, parsed);
		this.retain_snapshot_texts(preparation.options.texts, preparation.options.files.length > 0);
		return results;
	}

	/** Responsibilities: _uncached Python AST parsing_. **/
	private parse_source_ast(text: string): NormalizedAstFile {
		const batch_results = this.batch_ast({
			texts: [text],
			stage_timer: this._default_stage_timer,
			stage_prefix: PYTHON_AST_STAGE_PREFIX,
			files: [],
			repo_root: "",
		});
		const result = batch_results.at(0);
		if (result === undefined) {
			throw new Error(PYTHON_AST_EMPTY_SOURCE_RESULT_MESSAGE);
		}
		return result;
	}

	/** Responsibilities: _worker and cache initialization_, _default bridge composition_. **/
	public constructor(options: PythonAstBridgeOptions) {
		this._parsed_ast_cache = new Map<string, NormalizedAstFile>();
		this._default_stage_timer = new LintStageTimer();
		this._ast_model = new AstModel("python");
		this._batch_cache = new PythonAstBatchCache(
			this._parsed_ast_cache,
			options.cache_enabled,
			options.analysis_identity,
			options.file_io,
		);
		this._pending_batches = new Map<string, PythonBatchAstPreparation>();
		this._split_batch_enabled = options.split_batch_enabled;
		this._worker = options.worker;
	}

	/** Responsibilities: _Python AST batch request_. **/
	public begin_batch_ast(options: PythonBatchAstOptions): string {
		if (!this._split_batch_enabled) {
			return "";
		}
		const batch = this._batch_cache.prepare(options);
		if (batch.cache.missing_indexes.length === 0) {
			return "";
		}
		return this.begin_worker_batch(batch);
	}

	/** Responsibilities: _Python AST batch result_. **/
	public complete_batch_ast(pending_batch_id: string): NormalizedAstFile[] {
		const preparation = this._pending_batches.get(pending_batch_id);
		if (preparation === undefined) {
			throw new Error(PYTHON_AST_MISSING_SPLIT_BATCH_MESSAGE);
		}
		this._pending_batches.delete(pending_batch_id);
		return this.complete_batch_results(preparation, pending_batch_id);
	}

	/** Responsibilities: _abandoned split batch cancellation_. **/
	public cancel_batch_ast(pending_batch_id: string): void {
		const preparation = this._pending_batches.get(pending_batch_id);
		if (preparation === undefined) {
			return;
		}
		this._pending_batches.delete(pending_batch_id);
		preparation.worker_batch.cancel();
	}

	/** Responsibilities: _Python batches parsing_. **/
	public batch_ast(options: PythonBatchAstOptions): NormalizedAstFile[] {
		const results = this._batch_cache.resolve(options, (texts: readonly string[]) => {
			if (texts.length === 0) {
				return [];
			}
			return this.worker_batch_results(randomUUID(), texts, options.stage_timer, options.stage_prefix);
		});
		this.retain_snapshot_texts(options.texts, options.files.length > 0);
		return results;
	}

	/** Responsibilities: _retrieve cached ASTs_. **/
	public source_ast(text: string): NormalizedAstFile {
		const cached = this._batch_cache.cached(text);
		if (cached.present()) {
			return cached.value();
		}
		if (text.length === 0) {
			const empty = this._ast_model.empty_ast_file();
			this._parsed_ast_cache.set(text, empty);
			return empty;
		}
		return this.parse_source_ast(text);
	}
}
