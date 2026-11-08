import { AstModel } from "src/core/ast_model";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import { PythonAstWorkerBatch } from "src/core/python-ast/python_ast_worker_batch";
import type { PythonAstBridgeOptions, PythonAstWorkerAsts, PythonAstWorkerResponse } from "src/core/python-ast/types";
import { LintStageTimer } from "src/lint_stage_timer";
import type { NormalizedAstFile, PythonBatchAstOptions } from "src/model/ast/normalized_ast_types";
import type {
	PythonAstWorkerBatchContract,
	PythonAstWorkerBatchOwnerContract,
	PythonAstWorkerContract,
	PythonAstWorkerLeaseResourceContract,
} from "src/python_protocols";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

/** Responsibilities: _Python batch response simulation_, _batch parser setup_. **/
export class PythonAstBatchScenario implements PythonAstWorkerContract, PythonAstWorkerBatchOwnerContract {
	private _ast_model: AstModel;
	private readonly _analysis_identity: ProjectAnalysisIdentity;
	private readonly split_batch_enabled = true;
	private readonly _file_io: InMemoryFileIO;
	private _omitted_name: string;
	private _response_batch_id: string;
	private _pending_sources: Map<string, string>;
	private readonly _pending_batches: Set<PythonAstWorkerBatchContract>;
	private readonly _lease_resources: Set<PythonAstWorkerLeaseResourceContract>;
	private _response_count: number;
	private _closed: boolean;

	/** Responsibilities: _response AST entries_. **/
	private response_asts(sources: Map<string, string>): PythonAstWorkerAsts {
		let omitted_name = "";
		if (this._response_count === 0) {
			omitted_name = this._omitted_name;
		}
		this._response_count += 1;
		const asts = new Map<string, NormalizedAstFile>();
		for (const name of sources.keys()) {
			if (name !== omitted_name) {
				asts.set(name, this._ast_model.empty_ast_file());
			}
		}
		return asts;
	}

	/** Responsibilities: _batch response scenario initialization_. **/
	public constructor(omitted_name = "", response_batch_id = "") {
		this._ast_model = new AstModel("python");
		this._file_io = new InMemoryFileIO();
		this._analysis_identity = new ProjectAnalysisIdentity(this._file_io);
		this._omitted_name = omitted_name;
		this._response_batch_id = response_batch_id;
		this._pending_sources = new Map<string, string>();
		this._pending_batches = new Set<PythonAstWorkerBatchContract>();
		this._lease_resources = new Set<PythonAstWorkerLeaseResourceContract>();
		this._response_count = 0;
		this._closed = false;
	}

	/** Responsibilities: _worker batch identity_. **/
	public batch(batch_id: string, sources: Map<string, string>): PythonAstWorkerBatch {
		return new PythonAstWorkerBatch(batch_id, sources, this, this);
	}

	/** Responsibilities: _active batch validation_. **/
	public assert_active(): void {
		if (this._closed) {
			throw new Error("Worker session is closed.");
		}
	}

	/** Responsibilities: _pending batch registration_. **/
	public batch_started(batch: PythonAstWorkerBatchContract): void {
		this._pending_batches.add(batch);
	}

	/** Responsibilities: _pending batch removal_. **/
	public batch_finished(batch: PythonAstWorkerBatchContract): void {
		this._pending_batches.delete(batch);
	}

	/** Responsibilities: _lease resource registration_. **/
	public register_release_resource(resource: PythonAstWorkerLeaseResourceContract): void {
		this._lease_resources.add(resource);
	}

	/** Responsibilities: _lease resource removal_. **/
	public unregister_release_resource(resource: PythonAstWorkerLeaseResourceContract): void {
		this._lease_resources.delete(resource);
	}

	/** Responsibilities: _batch response creation_. **/
	public batch_result(batch_id: string, sources: Map<string, string>): PythonAstWorkerResponse {
		let response_batch_id = batch_id;
		if (this._response_batch_id.length > 0) {
			response_batch_id = this._response_batch_id;
		}
		return {
			batch_id: response_batch_id,
			asts: this.response_asts(sources),
			timings: { ast_parse_ms: 0, ast_build_ms: 0, ast_stages: [] },
		};
	}

	/** Responsibilities: _pending batch state_. **/
	public start_batch(_batch_id: string, sources: Map<string, string>): void {
		this._pending_sources = sources;
	}

	/** Responsibilities: _split batch response creation_. **/
	public complete_batch(batch_id: string): PythonAstWorkerResponse {
		return this.batch_result(batch_id, this._pending_sources);
	}

	/** Responsibilities: _abandoned batch response consumption_. **/
	public cancel_batch(batch_id: string): void {
		this.complete_batch(batch_id);
		this._pending_sources = new Map<string, string>();
	}

	/** Responsibilities: _stale response recovery_. **/
	public accept_current_batch_id(): void {
		this._response_batch_id = "";
	}

	/** Responsibilities: _parser dependency configuration_. **/
	public parser_options(): PythonAstBridgeOptions {
		return {
			worker: this,
			analysis_identity: this._analysis_identity,
			split_batch_enabled: this.split_batch_enabled,
			file_io: this._file_io,
			cache_enabled: false,
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
	public close(): void {
		this._pending_sources.clear();
		for (const resource of this._lease_resources) {
			resource.release_lease_resource();
		}
		this._lease_resources.clear();
		this._pending_batches.clear();
		this._closed = true;
	}

	/** Responsibilities: _worker shutdown resource reclamation_. **/
	public release_lease_resource(): void {
		this.close();
	}

	/** Responsibilities: _worker process completion_. **/
	public wait_for_exit(): Promise<void> {
		return Promise.resolve();
	}

	/** Responsibilities: _worker process state_. **/
	public has_exited(): boolean {
		return this._closed;
	}
}
