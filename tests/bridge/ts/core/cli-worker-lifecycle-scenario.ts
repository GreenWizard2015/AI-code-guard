import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { CliApplication } from "src/core/cli_application";
import { PYTHON_AST_WORKER_REGISTRIES } from "src/core/python-ast/constants";
import { PythonAstBridge } from "src/core/python-ast/python_ast_bridge";
import { PythonAstWorkerRegistry } from "src/core/python-ast/python_ast_worker_registry";
import type { PythonAstWorkerContract } from "src/python_protocols";
import type {
	ChangedInputObservation,
	ProjectRunObservation,
	RunDocuments,
	WorkerRunObservation,
} from "tests/bridge/ts/core/cli_application_worker_scenario_types";
import type { TaskReviewMemoryWorkspace } from "tests/bridge/ts/core/task-review-memory-workspace";

/** Responsibilities: _Python worker lease scope_, _CLI report comparison_. **/
export class CliWorkerLifecycleScenario {
	private readonly _scope_variable = "AI_CODE_GUARD_WORKER_LIFECYCLE_TEST_SCOPE";
	private readonly _previous_environment: Map<string, string>;
	private readonly _worker_key: string;
	private readonly _registry: PythonAstWorkerRegistry;
	private readonly _workers: PythonAstWorkerContract[];

	/** Responsibilities: _environment scope restoration_. **/
	private restore_scope(): void {
		const has_previous_scope = this._previous_environment.has(this._scope_variable);
		if (!has_previous_scope) {
			delete process.env[this._scope_variable];
			return;
		}
		const previous_scope = this._previous_environment.get(this._scope_variable);
		if (previous_scope === undefined) {
			delete process.env[this._scope_variable];
			return;
		}
		process.env[this._scope_variable] = previous_scope;
	}

	/** Responsibilities: _worker lease count_. **/
	private lease_count(): number {
		const worker_registry = PYTHON_AST_WORKER_REGISTRIES.get(process);
		if (worker_registry === undefined) {
			return 0;
		}
		const entry = worker_registry.get(this._worker_key);
		if (entry === undefined) {
			return 0;
		}
		return entry.leases.size;
	}

	/** Responsibilities: _lint report contents_. **/
	private run_documents(workspace: TaskReviewMemoryWorkspace): RunDocuments {
		const report_directory = join(workspace._root, ".ai-code-guard");
		return {
			issues: workspace._io.file(join(report_directory, "issues.md")).file_text(),
			lint_output: workspace._io.file(join(report_directory, "lint-output.md")).file_text(),
		};
	}

	/** Responsibilities: _report issue detection_. **/
	private has_reported_issues(documents: RunDocuments): boolean {
		const summary = /^Total issues: (\d+)\.$/mu.exec(documents.lint_output);
		if (summary === null) {
			return false;
		}
		return Number(summary[1]) > 0;
	}

	/** Responsibilities: _report equality comparison_. **/
	private documents_match(first: RunDocuments, second: RunDocuments): boolean {
		return first.issues === second.issues && first.lint_output === second.lint_output;
	}

	/** Responsibilities: _worker lease state_. **/
	private run_observation(workspace: TaskReviewMemoryWorkspace): WorkerRunObservation {
		return {
			documents: this.run_documents(workspace),
			lease_count: this.lease_count(),
			registry_entry_released: this.registry_entry_released(),
		};
	}

	/** Responsibilities: _CLI analysis execution_. **/
	private async capture_cli_run(
		application: CliApplication,
		workspace: TaskReviewMemoryWorkspace,
	): Promise<WorkerRunObservation> {
		await application.run_cli(["node", "cli.ts", "--root", workspace._root]);
		return this.run_observation(workspace);
	}

	/** Responsibilities: _changed source preparation_. **/
	private analyze_changed_source(
		application: CliApplication,
		workspace: TaskReviewMemoryWorkspace,
	): Promise<WorkerRunObservation> {
		const source_file = join(workspace._root, "source.py");
		const changed_source = [
			"def read_value():",
			"    try:",
			"        return 2",
			"    except Exception:",
			"        return 0",
		].join("\n");
		workspace._source_texts.set(source_file, changed_source);
		workspace._io.file(source_file).write_text(changed_source);
		return this.capture_cli_run(application, workspace);
	}

	/** Responsibilities: _worker scenario initialization_. **/
	public constructor() {
		this._previous_environment = new Map<string, string>();
		this._workers = [];
		const previous_scope = process.env[this._scope_variable];
		if (previous_scope !== undefined) {
			this._previous_environment.set(this._scope_variable, previous_scope);
		}
		process.env[this._scope_variable] = randomUUID();
		const bridge = new PythonAstBridge();
		this._worker_key = JSON.stringify([bridge.worker_arguments(), bridge.worker_options()]);
		this._registry = new PythonAstWorkerRegistry(process);
	}

	/** Responsibilities: _worker registry absence_. **/
	public registry_entry_released(): boolean {
		const worker_registry = PYTHON_AST_WORKER_REGISTRIES.get(process);
		if (worker_registry === undefined) {
			return true;
		}
		return !worker_registry.has(this._worker_key);
	}

	/** Responsibilities: _process exit tracking_. **/
	public capture_worker(): boolean {
		const worker_registry = PYTHON_AST_WORKER_REGISTRIES.get(process);
		if (worker_registry === undefined) {
			return false;
		}
		const entry = worker_registry.get(this._worker_key);
		if (entry === undefined) {
			return false;
		}
		this._workers.push(entry.worker);
		return true;
	}

	/** Responsibilities: _worker application cleanup_. **/
	public async close(): Promise<boolean> {
		try {
			await this._registry.close();
		} finally {
			this.restore_scope();
		}
		let workers_exited = this._workers.length > 0;
		for (const worker of this._workers) {
			await worker.wait_for_exit();
			if (!worker.has_exited()) {
				workers_exited = false;
			}
		}
		return workers_exited;
	}

	/** Responsibilities: _project lint and shutdown_. **/
	public async run_project(
		application: CliApplication,
		workspace: TaskReviewMemoryWorkspace,
	): Promise<ProjectRunObservation> {
		const worker_captured = this.capture_worker();
		let run: WorkerRunObservation;
		let worker_exited = false;
		try {
			await application.run_project(workspace.cli_options(true, false, "none"), workspace.stage_timer());
			run = this.run_observation(workspace);
		} finally {
			worker_exited = await this.close();
		}
		return { worker_captured, worker_exited, run };
	}

	/** Responsibilities: _changed input lifecycle_. **/
	public async run_changed_input(
		application: CliApplication,
		workspace: TaskReviewMemoryWorkspace,
	): Promise<ChangedInputObservation> {
		const worker_captured = this.capture_worker();
		let first_run: WorkerRunObservation;
		let second_run: WorkerRunObservation;
		let worker_exited = false;
		try {
			first_run = await this.capture_cli_run(application, workspace);
			second_run = await this.analyze_changed_source(application, workspace);
		} finally {
			worker_exited = await this.close();
		}
		return { worker_captured, worker_exited, first_run, second_run };
	}

	/** Responsibilities: _report issue detection_. **/
	public reports_contain_issues(observation: WorkerRunObservation): boolean {
		return this.has_reported_issues(observation.documents);
	}

	/** Responsibilities: _report content comparison_. **/
	public reports_match(observation: ChangedInputObservation): boolean {
		return this.documents_match(observation.first_run.documents, observation.second_run.documents);
	}
}
