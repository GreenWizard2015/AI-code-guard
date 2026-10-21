import { AstModel } from "src/core/ast_model";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import type {
	PythonAstWorkerAsts,
	PythonAstWorkerContract,
	PythonAstWorkerResponse,
	PythonAstWorkerSources,
} from "src/core/python-ast-worker.mjs";
import { LintStageTimer } from "src/lint_stage_timer";
import type { PythonAstDataOptions } from "src/python_types";
import type { NormalizedAstFileContract, PythonBatchAstOptions } from "src/types";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

/** Responsibilities: _Python batch response simulation_, _batch parser setup_. **/
export class PythonAstBatchScenario implements PythonAstWorkerContract {
	private ast_model: AstModel;
	private file_io: InMemoryFileIO;
	private analysis_identity: ProjectAnalysisIdentity;
	private omitted_name: string;
	private response_batch_id: string;
	private pending_batch_id: string;
	private pending_sources: PythonAstWorkerSources;
	private response_count: number;

	/** Responsibilities: _response AST entries_. **/
	private response_asts(sources: PythonAstWorkerSources): PythonAstWorkerAsts {
		let omitted_name = "";
		if (this.response_count === 0) {
			omitted_name = this.omitted_name;
		}
		this.response_count += 1;
		return new Map<string, NormalizedAstFileContract>(
			Object.keys(sources)
				.filter((name) => name !== omitted_name)
				.map((name) => [name, this.ast_model.empty_ast_file("python")] as const),
		);
	}

	/** Responsibilities: _batch response scenario initialization_. **/
	public constructor(omitted_name = "", response_batch_id = "") {
		this.ast_model = new AstModel();
		this.file_io = new InMemoryFileIO();
		this.analysis_identity = new ProjectAnalysisIdentity(this.file_io);
		this.omitted_name = omitted_name;
		this.response_batch_id = response_batch_id;
		this.pending_batch_id = "";
		this.pending_sources = {};
		this.response_count = 0;
	}

	/** Responsibilities: _batch response creation_. **/
	public batch_result(batch_id: string, sources: PythonAstWorkerSources): PythonAstWorkerResponse {
		let response_batch_id = batch_id;
		if (this.response_batch_id.length > 0) {
			response_batch_id = this.response_batch_id;
		}
		return {
			batchId: response_batch_id,
			asts: this.response_asts(sources),
			timings: { ast_parse_ms: 0, ast_build_ms: 0, ast_stages: [] },
		};
	}

	/** Responsibilities: _pending batch state_. **/
	public start_batch(batch_id: string, sources: PythonAstWorkerSources): void {
		this.pending_batch_id = batch_id;
		this.pending_sources = sources;
	}

	/** Responsibilities: _split batch response creation_. **/
	public complete_batch(): PythonAstWorkerResponse {
		return this.batch_result(this.pending_batch_id, this.pending_sources);
	}

	/** Responsibilities: _stale response recovery_. **/
	public accept_current_batch_id(): void {
		this.response_batch_id = "";
	}

	/** Responsibilities: _parser dependency configuration_. **/
	public parser_options(): PythonAstDataOptions {
		return {
			worker: this,
			analysis_identity: this.analysis_identity,
			split_batch_enabled: true,
			file_io: this.file_io,
		};
	}

	/** Responsibilities: _batch input values_. **/
	public batch_options(texts: readonly string[]): PythonBatchAstOptions {
		return {
			texts,
			stage_timer: new LintStageTimer(),
			stage_prefix: "python-bridge",
			files: [],
			repo_root: "",
		};
	}

	/** Responsibilities: _worker lifecycle_. **/
	public close(): void {}
}
