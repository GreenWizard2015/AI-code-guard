import {
	PYTHON_AST_BUILD_STAGE,
	PYTHON_AST_INCOMPLETE_BATCH_MESSAGE,
	PYTHON_AST_PARSE_STAGE,
	PYTHON_AST_UNEXPECTED_BATCH_ID_MESSAGE,
	PYTHON_AST_UNEXPECTED_LANGUAGE_MESSAGE,
} from "src/core/python-ast/constants";
import type { PythonAstWorkerResponse } from "src/core/python-ast/types";
import type { NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import type { PythonAstBatchResultOptions } from "src/python_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";

/** Responsibilities: _Python batch response validation_, _bridge timing collection_. **/
export class PythonAstBatchResult {
	private readonly _batch_id: string;
	private readonly _texts: readonly string[];
	private readonly _response: PythonAstWorkerResponse;
	private readonly _stage_timer: LintStageTimerContract;
	private readonly _stage_prefix: string;

	/** Responsibilities: _named bridge AST resolution_. **/
	private response_ast(name: string): NormalizedAstFile {
		if (!this._response.asts.has(name)) {
			throw new Error(PYTHON_AST_INCOMPLETE_BATCH_MESSAGE);
		}
		const parsed = this._response.asts.get(name);
		if (parsed === undefined) {
			throw new Error(PYTHON_AST_INCOMPLETE_BATCH_MESSAGE);
		}
		return { ...parsed, references: { ...parsed.references, type_members: new Map() } };
	}

	/** Responsibilities: _Python batch response initialization_. **/
	public constructor(options: PythonAstBatchResultOptions) {
		this._batch_id = options.batch_id;
		this._texts = options.texts;
		this._response = options.response;
		this._stage_timer = options.stage_timer;
		this._stage_prefix = options.stage_prefix;
	}

	/** Responsibilities: _bridge timing collection_. **/
	public record_timings(): void {
		this._stage_timer.add_duration({
			name: `${this._stage_prefix}.bridge-round-trip.${PYTHON_AST_PARSE_STAGE}`,
			duration_ms: this._response.timings.ast_parse_ms,
		});
		this._stage_timer.add_duration({
			name: `${this._stage_prefix}.bridge-round-trip.${PYTHON_AST_BUILD_STAGE}`,
			duration_ms: this._response.timings.ast_build_ms,
		});
		for (const timing of this._response.timings.ast_stages) {
			this._stage_timer.add_duration({
				name: `${this._stage_prefix}.bridge-round-trip.${PYTHON_AST_BUILD_STAGE}.${timing.name}`,
				duration_ms: timing.duration_ms,
			});
		}
	}

	/** Responsibilities: _Python batch AST collection_. **/
	public validated_results(): NormalizedAstFile[] {
		if (this._response.batch_id !== this._batch_id) {
			throw new Error(PYTHON_AST_UNEXPECTED_BATCH_ID_MESSAGE);
		}
		return this._texts.map((_, index) => {
			const parsed = this.response_ast(String(index));
			if (parsed.source.language !== "python") {
				throw new Error(PYTHON_AST_UNEXPECTED_LANGUAGE_MESSAGE);
			}
			return parsed;
		});
	}
}
