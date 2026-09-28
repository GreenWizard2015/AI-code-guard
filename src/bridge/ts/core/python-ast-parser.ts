import { randomUUID } from 'node:crypto';
import { AstModel } from 'src/bridge/ts/core/ast-model';
import { PythonAstBridge } from 'src/bridge/ts/core/python-ast-bridge';
import { PythonAstWorker } from 'src/bridge/ts/core/python-ast-worker.mjs';
import type { PythonAstWorkerResponse } from 'src/bridge/ts/core/python-ast-worker.mjs';
import type {
	NormalizedAstFile,
	PythonBatchAstOptions,
} from 'src/types';
import { LintStageTimer } from 'src/stage-timing';
import { PythonAstBatchCache } from 'src/bridge/ts/core/python-ast-batch-cache';
import type { LintStageTimerProtocol } from 'src/protocols';

/** Responsibilities: _cache Python AST batches_. **/
export class PythonAstData {
	private readonly parsed_ast_cache = new Map<string, NormalizedAstFile>();
	private readonly batch_cache = new PythonAstBatchCache(
		this.parsed_ast_cache,
		process.env.NODE_ENV !== 'test',
	);
	private readonly ast_model = new AstModel();
	private readonly default_stage_timer = new LintStageTimer();
	private readonly worker: PythonAstWorker;

	/** Responsibilities: _Python results validation_. **/
	private validate_bridge_output(parsed: NormalizedAstFile): void {
		if (parsed.language !== 'python') {
			throw new Error('Python AST bridge returned an unexpected language.');
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
		stage_timer: LintStageTimerProtocol,
		stage_prefix: string,
		response: PythonAstWorkerResponse
	): void {
		stage_timer.add_duration(
			`${stage_prefix}.bridge-round-trip.python-ast-parse`,
			response.timings.ast_parse_ms
		);
		stage_timer.add_duration(
			`${stage_prefix}.bridge-round-trip.python-ast-build`,
			response.timings.ast_build_ms
		);
		for (const timing of response.timings.ast_stages) {
			stage_timer.add_duration(
				`${stage_prefix}.bridge-round-trip.python-ast-build.${timing.name}`,
				timing.duration_ms
			);
		}
	}

	/** Responsibilities: _named bridge AST resolution_. **/
	private response_ast(response: PythonAstWorkerResponse, name: string): NormalizedAstFile {
		for (const [response_name, parsed] of Object.entries(response.asts)) {
			if (response_name === name) {
				return parsed;
			}
		}
		throw new Error('Python AST worker returned an incomplete batch.');
	}

	/** Responsibilities: _bridge batch validation_. **/
	private validated_batch_results(
		batch_id: string,
		texts: readonly string[],
		response: PythonAstWorkerResponse
	): NormalizedAstFile[] {
		if (response.batchId !== batch_id) {
			throw new Error('Python AST worker returned an unexpected batch id.');
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
		stage_timer: LintStageTimerProtocol,
		stage_prefix = 'python-bridge'
	): NormalizedAstFile[] {
		const sources = stage_timer.measure(
			`${stage_prefix}.batch-source-map`,
			() => this.source_map(texts)
		);
		const response = stage_timer.measure(
			`${stage_prefix}.bridge-round-trip`,
			() => this.worker.batch_result(batch_id, sources)
		);
		this.record_bridge_timings(stage_timer, stage_prefix, response);
		return stage_timer.measure(
			`${stage_prefix}.response-validation`,
			() => this.validated_batch_results(batch_id, texts, response)
		);
	}

	/** Responsibilities: _nonempty batches parsing_. **/
	private parse_bridge_batch(
		texts: readonly string[],
		stage_timer: LintStageTimerProtocol,
		stage_prefix = 'python-bridge'
	): NormalizedAstFile[] {
		if (texts.length === 0) {
			return [];
		}
		return this.worker_batch_results(randomUUID(), texts, stage_timer, stage_prefix);
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
	public batch_ast(options: PythonBatchAstOptions): NormalizedAstFile[] {
		return this.batch_cache.resolve(options, texts => this.parse_bridge_batch(
			texts,
			options.stage_timer,
			options.stage_prefix
		));
	}

	/** Responsibilities: _retrieve cached ASTs_. **/
	public source_ast(text: string): NormalizedAstFile {
		const cached = this.batch_cache.cached(text);
		if (cached.present()) {
			return cached.value();
		}
		if (text.length === 0) {
			const empty = this.ast_model.empty_ast_file('python');
			this.parsed_ast_cache.set(text, empty);
			return empty;
		}
		return this.batch_ast({
			texts: [text],
			stage_timer: this.default_stage_timer,
			stage_prefix: 'python-bridge',
			files: [],
			repo_root: '',
		})[0];
	}

}
