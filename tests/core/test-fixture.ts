import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import type { PythonAstWorkerContract } from "src/core/python-ast-worker.mjs";
import { PythonAstData } from "src/core/python_ast_data";
import { LintReportMode, type LintReportOptions } from "src/core/types";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { NodeFileIO } from "src/io/node_file_io";
import type { IOContract } from "src/io/protocols";
import { LintStageTimer } from "src/lint_stage_timer";
import type { LintRunResult } from "src/project_analysis_types";
import type { PythonAstDataOptions } from "src/python_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintExecutionReport } from "src/runtime_types";
import { SourceText } from "src/source_text";
import { FixtureAstMapper } from "tests/core/fixture_ast_mapper";
import { ProjectSourceFixture } from "tests/core/project_source_fixture";
import type { Fixture } from "tests/core/types";

/** Responsibilities: _in-memory project fixtures_, _lint execution fixtures_, _AST fixtures_. **/
export class TestFixture {
	private readonly placement_fixture_prefix = "module-placement-";
	private readonly python_ast_worker: PythonAstWorkerContract;
	public readonly ast_nodes: FixtureAstMapper;
	public readonly project_source: ProjectSourceFixture;

	/** Responsibilities: _fixture lint configuration creation_. **/
	private lint_configuration(): LintRunConfiguration {
		return new LintRunConfiguration(new SourceText(), new NodeFileIO());
	}

	/** Responsibilities: _fixture adapter initialization_. **/
	public constructor() {
		this.python_ast_worker = this.lint_configuration().python_ast_worker;
		this.ast_nodes = new FixtureAstMapper();
		this.project_source = new ProjectSourceFixture(this.python_ast_worker);
	}

	/** Responsibilities: _fixture file access_. **/
	public file_io(): IOContract {
		return new NodeFileIO();
	}

	/** Responsibilities: _shared Python worker access_. **/
	public worker(): PythonAstWorkerContract {
		return this.python_ast_worker;
	}

	/** Responsibilities: _test stage timer creation_. **/
	public stage_timer(): LintStageTimer {
		return new LintStageTimer();
	}

	/** Responsibilities: _Python AST parser options_. **/
	public python_ast_options(split_batch_enabled = false): PythonAstDataOptions {
		const file_io = new NodeFileIO();
		return {
			worker: this.worker(),
			analysis_identity: new ProjectAnalysisIdentity(file_io),
			split_batch_enabled,
			file_io,
		};
	}

	/** Responsibilities: _Python AST data_. **/
	public python_ast_data(split_batch_enabled = false): PythonAstData {
		return new PythonAstData(this.python_ast_options(split_batch_enabled));
	}

	/** Responsibilities: _isolated PATH configuration_. **/
	public with_empty_path<T>(callback: () => T): T {
		const original_path = process.env.PATH;
		process.env.PATH = "";
		try {
			return callback();
		} finally {
			if (original_path === undefined) {
				process.env.PATH = undefined;
			} else {
				process.env.PATH = original_path;
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
			[".ts", ".tsx", ".py"].some((extension) => file.endsWith(extension)),
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
				entry_files: [...entry_files],
			},
			mode: LintReportMode.IN_MEMORY_PROJECT,
		};
	}

	/** Responsibilities: _production lint execution lifecycle_. **/
	public with_lint_request<T>(
		configuration: LintRunConfiguration,
		files: Record<string, string>,
		callback: (configuration: LintRunConfiguration, options: LintReportOptions, mode: LintReportMode) => T,
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
		callback: (configuration: LintRunConfiguration, options: LintReportOptions, mode: LintReportMode) => T,
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

	/** Responsibilities: _fixture violation messages collection_. **/
	public violation_messages(files: Record<string, string>): string[] {
		const violations = this.collect_fixture_violations(files);
		const messages = violations.map((violation) => violation.message);
		return [...messages];
	}

	/** Responsibilities: _shared-parameter violations selection_. **/
	public shared_violations(violations: readonly ViolationContract[]): ViolationContract[] {
		const shared = violations.filter((violation) => violation.message.includes("share parameter"));
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
