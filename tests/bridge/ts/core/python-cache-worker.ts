import type { AstModel } from "src/core/ast_model";
import type {
	PythonAstWorkerContract,
	PythonAstWorkerResponse,
	PythonAstWorkerSources,
} from "src/core/python-ast-worker.mjs";

/** Responsibilities: _worker responses_, _worker requests_. **/
export class PythonCacheWorker implements PythonAstWorkerContract {
	private readonly result: ReturnType<AstModel["empty_ast_file"]>;
	public calls = 0;

	/** Responsibilities: _cached AST fixture initialization_. **/
	public constructor(result: ReturnType<AstModel["empty_ast_file"]>) {
		this.result = result;
	}

	/** Responsibilities: _batch AST fixture delivery_. **/
	public batch_result(batch_id: string, sources: PythonAstWorkerSources): PythonAstWorkerResponse {
		this.calls += 1;
		return {
			batchId: batch_id,
			asts: new Map(Object.keys(sources).map((name) => [name, this.result])),
			timings: { ast_parse_ms: 0, ast_build_ms: 0, ast_stages: [] },
		};
	}

	/** Responsibilities: _worker fixture shutdown_. **/
	public close(): void {}
}
