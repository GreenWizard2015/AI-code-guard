import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { AstModel } from "src/core/ast_model";
import { PYTHON_AST_INCOMPLETE_BATCH_MESSAGE, PYTHON_AST_STAGE_PREFIX } from "src/core/constants";
import type { PythonAstWorkerContract, PythonAstWorkerResponse } from "src/core/python-ast-worker.mjs";
import type {
	NormalizedAstFile,
	PythonAstCacheBatch,
	PythonBatchAstOptions,
	PythonBatchAstPreparation,
} from "src/types";
import { LintStageTimer } from "src/lint_stage_timer";
import { PythonAstBatchCache } from "src/core/python_ast_batch_cache";
import type {
	AstModelContract,
	LintStageTimerContract,
	PythonAstDataContract,
	PythonAstDataOptions,
} from "src/protocols";

/** Responsibilities: _Python AST ownership_, _batch cache_, _worker state_. **/
export class PythonAstData implements PythonAstDataContract {
	private readonly parsed_ast_cache: Map<string, NormalizedAstFile>;
	private readonly batch_cache: PythonAstBatchCache;
	private readonly ast_model: AstModelContract;
	private readonly default_stage_timer: LintStageTimerContract;
	private readonly worker: PythonAstWorkerContract;
	private readonly pending_batches: Map<string, PythonBatchAstPreparation>;
	private readonly split_batch_enabled: boolean;
	private readonly split_batch_error = "Python AST worker does not support split batches.";

	/** Responsibilities: _Python results validation_. **/
	private validate_bridge_output(parsed: NormalizedAstFile): void {
		if (parsed.language !== "python") {
			throw new Error("Python AST bridge returned an unexpected language.");
		}
	}

	/** Responsibilities: _encode batch sources_. **/
	private source_map(texts: readonly string[]): Record<string, string> {
		const sources: Record<string, string> = {};
		for (const [index, text] of texts.entries()) {
			sources[String(index)] = text;
		}
		return sources;
	}

	/** Responsibilities: _record Python bridge timings_. **/
	private record_bridge_timings(
		stage_timer: LintStageTimerContract,
		stage_prefix: string,
		response: PythonAstWorkerResponse,
	): void {
		stage_timer.add_duration(`${stage_prefix}.bridge-round-trip.python-ast-parse`, response.timings.ast_parse_ms);
		stage_timer.add_duration(`${stage_prefix}.bridge-round-trip.python-ast-build`, response.timings.ast_build_ms);
		for (const timing of response.timings.ast_stages) {
			stage_timer.add_duration(`${stage_prefix}.bridge-round-trip.python-ast-build.${timing.name}`, timing.duration_ms);
		}
	}

	/** Responsibilities: _named bridge AST resolution_. **/
	private response_ast(response: PythonAstWorkerResponse, name: string): NormalizedAstFile {
		if (!response.asts.has(name)) {
			throw new Error(PYTHON_AST_INCOMPLETE_BATCH_MESSAGE);
		}
		const parsed = response.asts.get(name);
		if (parsed === undefined) {
			throw new Error(PYTHON_AST_INCOMPLETE_BATCH_MESSAGE);
		}
		return { ...parsed, type_members: new Map() };
	}

	/** Responsibilities: _bridge batch validation_. **/
	private validated_batch_results(
		batch_id: string,
		texts: readonly string[],
		response: PythonAstWorkerResponse,
	): NormalizedAstFile[] {
		if (response.batchId !== batch_id) {
			throw new Error("Python AST worker returned an unexpected batch id.");
		}
		return texts.map((_, index) => {
			const parsed = this.response_ast(response, String(index));
			this.validate_bridge_output(parsed);
			return parsed;
		});
	}

	/** Responsibilities: _worker batch validation_. **/
	private worker_batch_results(
		batch_id: string,
		texts: readonly string[],
		stage_timer: LintStageTimerContract,
		stage_prefix = "",
	): NormalizedAstFile[] {
		let resolved_stage_prefix = PYTHON_AST_STAGE_PREFIX;
		if (stage_prefix.length > 0) {
			resolved_stage_prefix = stage_prefix;
		}
		const sources = stage_timer.measure(`${resolved_stage_prefix}.batch-source-map`, () => this.source_map(texts));
		const response = stage_timer.measure(`${resolved_stage_prefix}.bridge-round-trip`, () =>
			this.worker.batch_result(batch_id, sources),
		);
		this.record_bridge_timings(stage_timer, resolved_stage_prefix, response);
		return stage_timer.measure(`${resolved_stage_prefix}.response-validation`, () =>
			this.validated_batch_results(batch_id, texts, response),
		);
	}

	/** Responsibilities: _split batch capability_. **/
	private split_batch_supported(): boolean {
		if (!this.split_batch_enabled) {
			return false;
		}
		if (this.worker.start_batch === undefined) {
			return false;
		}
		return this.worker.complete_batch !== undefined;
	}

	/** Responsibilities: _split batch start_. **/
	private start_batch(batch_id: string, sources: Record<string, string>): void {
		const start_batch = this.worker.start_batch;
		if (start_batch === undefined) {
			throw new Error(this.split_batch_error);
		}
		start_batch.call(this.worker, batch_id, sources);
	}

	/** Responsibilities: _split batch completion_. **/
	private complete_batch(): PythonAstWorkerResponse {
		const complete_batch = this.worker.complete_batch;
		if (complete_batch === undefined) {
			throw new Error(this.split_batch_error);
		}
		return complete_batch.call(this.worker);
	}

	/** Responsibilities: _split batch stage prefix_. **/
	private stage_prefix(options: PythonBatchAstOptions): string {
		if (options.stage_prefix.length > 0) {
			return options.stage_prefix;
		}
		return PYTHON_AST_STAGE_PREFIX;
	}

	/** Responsibilities: _split batch request start_. **/
	private begin_worker_batch(options: PythonBatchAstOptions, batch: PythonAstCacheBatch): string {
		const batch_id = randomUUID();
		const prefix = this.stage_prefix(options);
		const sources = options.stage_timer.measure(`${prefix}.batch-source-map`, () =>
			this.source_map(batch.cache.missing_texts),
		);
		const started_at = performance.now();
		this.start_batch(batch_id, sources);
		this.pending_batches.set(batch_id, {
			options: batch.options,
			cache: batch.cache,
			batch_id,
			started_at,
		});
		return batch_id;
	}

	/** Responsibilities: _split batch result completion_. **/
	private complete_batch_results(preparation: PythonBatchAstPreparation): NormalizedAstFile[] {
		const prefix = this.stage_prefix(preparation.options);
		const response = this.complete_batch();
		preparation.options.stage_timer.add_duration(
			`${prefix}.bridge-round-trip`,
			performance.now() - preparation.started_at,
		);
		this.record_bridge_timings(preparation.options.stage_timer, prefix, response);
		const parsed = preparation.options.stage_timer.measure(`${prefix}.response-validation`, () =>
			this.validated_batch_results(preparation.batch_id, preparation.cache.missing_texts, response),
		);
		return this.batch_cache.complete({ options: preparation.options, cache: preparation.cache }, parsed);
	}

	/** Responsibilities: _worker and cache initialization_, _default bridge composition_. **/
	public constructor(options: PythonAstDataOptions) {
		this.parsed_ast_cache = new Map<string, NormalizedAstFile>();
		this.default_stage_timer = new LintStageTimer();
		this.ast_model = new AstModel();
		this.batch_cache = new PythonAstBatchCache(
			this.parsed_ast_cache,
			process.env.NODE_ENV !== "test",
			options.analysis_identity,
			options.file_io,
		);
		this.pending_batches = new Map<string, PythonBatchAstPreparation>();
		this.split_batch_enabled = options.split_batch_enabled;
		this.worker = options.worker;
	}

	/** Responsibilities: _Python AST batch request_. **/
	public begin_batch_ast(options: PythonBatchAstOptions): string {
		if (!this.split_batch_supported()) {
			return "";
		}
		const batch = this.batch_cache.prepare(options);
		if (batch.cache.missing_indexes.length === 0) {
			return "";
		}
		return this.begin_worker_batch(options, batch);
	}

	/** Responsibilities: _Python AST batch result_. **/
	public complete_batch_ast(batch_id: string): NormalizedAstFile[] {
		const preparation = this.pending_batches.get(batch_id);
		if (preparation === undefined) {
			throw new Error("Python AST split batch is missing.");
		}
		this.pending_batches.delete(batch_id);
		return this.complete_batch_results(preparation);
	}

	/** Responsibilities: _Python batches parsing_. **/
	public batch_ast(options: PythonBatchAstOptions): NormalizedAstFile[] {
		return this.batch_cache.resolve(options, (texts: readonly string[]) => {
			if (texts.length === 0) {
				return [];
			}
			return this.worker_batch_results(randomUUID(), texts, options.stage_timer, options.stage_prefix);
		});
	}

	/** Responsibilities: _retrieve cached ASTs_. **/
	public source_ast(text: string): NormalizedAstFile {
		const cached = this.batch_cache.cached(text);
		if (cached.present()) {
			return cached.value();
		}
		if (text.length === 0) {
			const empty = this.ast_model.empty_ast_file("python");
			this.parsed_ast_cache.set(text, empty);
			return empty;
		}
		const batch_results = this.batch_ast({
			texts: [text],
			stage_timer: this.default_stage_timer,
			stage_prefix: PYTHON_AST_STAGE_PREFIX,
			files: [],
			repo_root: "",
		});
		return batch_results[0];
	}
}
