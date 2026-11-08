import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { NODE_ENV_VARIABLE } from "src/core/constants";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import { PythonAstData } from "src/core/python-ast/python_ast_data";
import type { PythonAstBridgeOptions } from "src/core/python-ast/types";
import { LintReportMode, type LintReportOptions } from "src/core/types";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { NodeFileIO } from "src/io/node_file_io";
import type { IOContract } from "src/io/protocols";
import { SourceText } from "src/io/source_text";
import { LintStageTimer } from "src/lint_stage_timer";
import type { LintRunResult } from "src/project_analysis_types";
import type { PythonAstWorkerCapabilityContract } from "src/python_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintExecutionReport } from "src/runtime_types";
import { FixtureAstMapper } from "tests/core/fixture_ast_mapper";
import { ProjectSourceFixture } from "tests/core/project_source_fixture";
import type { CallableLintRequest, CallablePathAction, Fixture } from "tests/core/types";

/** Responsibilities: _in-memory project fixtures_, _lint execution fixtures_, _AST fixtures_. **/
export class TestFixture {
	private readonly placement_fixture_prefix = "module-placement-";
	private readonly _python_ast_workers: WeakMap<TestFixture, PythonAstWorkerCapabilityContract>;
	public readonly _ast_nodes: FixtureAstMapper;
	public readonly _project_source: ProjectSourceFixture;

	/** Responsibilities: _fixture lint configuration creation_. **/
	private lint_configuration(): LintRunConfiguration {
		return new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd()));
	}

	/** Responsibilities: _shared bridge worker initialization_. **/
	private active_python_ast_worker(): PythonAstWorkerCapabilityContract {
		const existing_worker = this._python_ast_workers.get(this);
		if (existing_worker !== undefined) {
			return existing_worker;
		}
		const worker = this.lint_configuration().active_worker_session().worker();
		this._python_ast_workers.set(this, worker);
		return worker;
	}

	/** Responsibilities: _fixture adapter initialization_. **/
	public constructor() {
		this._python_ast_workers = new WeakMap<TestFixture, PythonAstWorkerCapabilityContract>();
		this._ast_nodes = new FixtureAstMapper();
		this._project_source = new ProjectSourceFixture(() => this.active_python_ast_worker());
	}

	/** Responsibilities: _fixture file access_. **/
	public file_io(): IOContract {
		return new NodeFileIO(process.cwd());
	}

	/** Responsibilities: _shared Python worker access_. **/
	public worker(): PythonAstWorkerCapabilityContract {
		return this.active_python_ast_worker();
	}

	/** Responsibilities: _test stage timer creation_. **/
	public stage_timer(): LintStageTimer {
		return new LintStageTimer();
	}

	/** Responsibilities: _Python AST parser options_. **/
	public python_ast_options(split_batch_enabled = false): PythonAstBridgeOptions {
		const file_io = new NodeFileIO(process.cwd());
		return {
			worker: this.worker(),
			analysis_identity: new ProjectAnalysisIdentity(file_io),
			split_batch_enabled: split_batch_enabled,
			file_io: file_io,
			cache_enabled: process.env[NODE_ENV_VARIABLE] !== "test",
		};
	}

	/** Responsibilities: _Python AST data_. **/
	public python_ast_data(split_batch_enabled = false): PythonAstData {
		return new PythonAstData(this.python_ast_options(split_batch_enabled));
	}

	/** Responsibilities: _isolated PATH configuration_. **/
	public with_empty_path<T>(callback: CallablePathAction<T>): T {
		const path_key = "PATH";
		const original_path = process.env[path_key];
		process.env[path_key] = "";
		try {
			return callback();
		} finally {
			if (original_path === undefined) {
				process.env[path_key] = undefined;
			} else {
				process.env[path_key] = original_path;
			}
		}
	}

	/** Responsibilities: _execution lint collection fixture_. **/
	public collect_fixture_execution(
		files: Record<string, string>,
		selected_files: readonly string[] = [],
		entry_files: readonly string[] = [],
	): LintExecutionReport {
		const lint_run_factory = this.lint_configuration();
		const request = this.fixture_lint_request(files, selected_files, entry_files);
		return lint_run_factory.lint_report(request.options, request.mode);
	}

	/** Responsibilities: _in-memory lint request preparation_. **/
	public fixture_lint_request(
		files: Record<string, string>,
		selected_files: readonly string[] = [],
		entry_files: readonly string[] = [],
	): { options: LintReportOptions; mode: LintReportMode } {
		const virtual_root = `/virtual/ai-code-guard-project/${randomUUID()}`;
		const source_io = new InMemoryProjectSourceIO(
			new Map(Object.entries(files).map(([file, text]) => [resolve(virtual_root, file), text])),
		);
		const entries = Object.entries(files).sort(([left], [right]) => {
			const left_path = resolve(virtual_root, left);
			const right_path = resolve(virtual_root, right);
			if (left_path < right_path) {
				return -1;
			}
			if (left_path > right_path) {
				return 1;
			}
			return 0;
		});
		const source_entries = entries.filter(([file]) =>
			[".ts", ".tsx", ".mts", ".cts", ".py"].some((extension) => file.endsWith(extension)),
		);
		const markdown_entries = entries.filter(([file]) => file.endsWith(".md"));
		const project_paths = source_entries.map(([file]) => resolve(virtual_root, file));
		const source_texts = new Map(
			entries.map(([file]) => {
				const path = resolve(virtual_root, file);
				return [path, source_io.source_text(path)];
			}),
		);
		const markdown_files = markdown_entries.map(([file]) => resolve(virtual_root, file));
		const input_entries = [...source_entries, ...markdown_entries];
		const all_paths = new Map(input_entries.map(([file]) => [file, resolve(virtual_root, file)]));
		const selected_paths: string[] = [];
		if (selected_files.length === 0) {
			selected_paths.push(...project_paths);
		} else {
			for (const file of selected_files) {
				const selected_path = all_paths.get(file);
				if (selected_path !== undefined) {
					selected_paths.push(selected_path);
				}
			}
		}
		const inputs = {
			files: selected_paths.filter((file) => project_paths.includes(file)),
			project_files: project_paths,
			ignored_files: [],
			markdown_files,
			ignore_files: [],
		};
		return {
			options: {
				repo_root: virtual_root,
				ignored_directories: [],
				stage_timer: new LintStageTimer(),
				inputs,
				source_texts,
				configuration_snapshot_complete: false,
				entry_files: [...entry_files],
				project_analysis_enabled: false,
			},
			mode: LintReportMode.IN_MEMORY_PROJECT,
		};
	}

	/** Responsibilities: _production lint execution lifecycle_. **/
	public with_lint_request<T>(
		configuration: LintRunConfiguration,
		files: Record<string, string>,
		callback: CallableLintRequest<T>,
		selected_files: readonly string[] = [],
		entry_files: readonly string[] = [],
	): T {
		const request = this.fixture_lint_request(files, selected_files, entry_files);
		return callback(configuration, request.options, request.mode);
	}

	/** Responsibilities: _shared bridge lint request_. **/
	public with_shared_lint_request<T>(
		configuration: LintRunConfiguration,
		files: Record<string, string>,
		callback: CallableLintRequest<T>,
		selected_files: readonly string[] = [],
		entry_files: readonly string[] = [],
	): T {
		const request = this.fixture_lint_request(files, selected_files, entry_files);
		return callback(configuration, request.options, request.mode);
	}

	/** Responsibilities: _fixture report collection_. **/
	public collect_fixture_report(
		files: Record<string, string>,
		selected_files: readonly string[] = [],
		entry_files: readonly string[] = [],
	): LintRunResult {
		return this.collect_fixture_execution(files, selected_files, entry_files).report;
	}

	/** Responsibilities: _fixture violations collection_. **/
	public collect_fixture_violations(
		files: Record<string, string>,
		selected_files: readonly string[] = [],
		entry_files: readonly string[] = [],
	): ViolationContract[] {
		return this.collect_fixture_report(files, selected_files, entry_files).violations;
	}

	/** Responsibilities: _production fixture violations_. **/
	public collect_fixture_violations_with(
		configuration: LintRunConfiguration,
		files: Record<string, string>,
	): ViolationContract[] {
		return this.with_lint_request(
			configuration,
			files,
			(lint_configuration, options, mode) => lint_configuration.lint_report(options, mode).report.violations,
		);
	}

	/** Responsibilities: _fixture violation messages collection_. **/
	public violation_messages(files: Record<string, string>): string[] {
		const violations = this.collect_fixture_violations(files);
		const messages = violations.map((violation) => violation.message());
		return [...messages];
	}

	/** Responsibilities: _shared-parameter violations selection_. **/
	public shared_violations(violations: readonly ViolationContract[]): ViolationContract[] {
		const shared = violations.filter((violation) => violation.message().includes("share parameter"));
		if (shared.length === 0) {
			return [];
		}
		return [...shared];
	}

	/** Responsibilities: _virtual source snapshot creation_. **/
	public fixture(files: Record<string, string>): Fixture {
		const root = resolve(`/virtual/${this.placement_fixture_prefix}${randomUUID()}`);
		const source_texts = new Map(Object.entries(files).map(([file, text]) => [resolve(root, file), text]));
		return { root, paths: [...source_texts.keys()], source_texts };
	}
}
