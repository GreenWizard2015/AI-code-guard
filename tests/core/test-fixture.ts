import { resolve } from "node:path";
import { LintProjectContextCreator } from "src/core/lint_project_context_creator";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { PythonAstData } from "src/core/python_ast_data";
import type { PythonAstWorkerContract } from "src/core/python-ast-worker.mjs";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import { ProjectSourceScanner } from "src/core/project-source/project_source_scanner";
import { LintStageTimer } from "src/lint_stage_timer";
import type { PythonAstDataOptions, ViolationContract } from "src/protocols";
import type { IOContract } from "src/io/protocols";
import type { LintExecutionReport, LintRunResult } from "src/types";
import { randomUUID } from "node:crypto";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/source_text";
import { LintReportMode, type LintReportOptions } from "src/core/types";
import type { LintProjectContextContract, LintStageTimerContract } from "src/protocols";
import type { ProjectSourceAnalysisOptions } from "src/types";
import { FixtureAstMapper } from "tests/core/fixture_ast_mapper";
import type { Fixture } from "tests/core/types";
import type ts from "typescript";

/** Responsibilities: _in-memory project fixtures_, _lint execution fixtures_, _AST fixtures_. **/
export class TestFixture {
	private readonly placement_fixture_prefix = "module-placement-";
	private readonly python_ast_worker: PythonAstWorkerContract;
	public readonly ast_nodes: FixtureAstMapper;

	/** Responsibilities: _fixture lint configuration creation_. **/
	private lint_configuration(): LintRunConfiguration {
		return new LintRunConfiguration(new SourceText(), new NodeFileIO());
	}

	/** Responsibilities: _fixture adapter initialization_. **/
	public constructor() {
		this.python_ast_worker = this.lint_configuration().python_ast_worker;
		this.ast_nodes = new FixtureAstMapper();
	}

	/** Responsibilities: _fixture file access_. **/
	public file_io(): IOContract {
		return new NodeFileIO();
	}

	/** Responsibilities: _shared Python worker access_. **/
	public worker(): PythonAstWorkerContract {
		return this.python_ast_worker;
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

	/** Responsibilities: _test stage timer creation_. **/
	public stage_timer(): LintStageTimer {
		return new LintStageTimer();
	}

	/** Responsibilities: _isolated PATH configuration_. **/
	public with_empty_path<T>(callback: () => T): T {
		const original_path = process.env.PATH;
		process.env.PATH = "";
		try {
			return callback();
		} finally {
			if (original_path === undefined) {
				delete process.env.PATH;
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

	/** Responsibilities: _in-memory project context creation_, _Python bridge cleanup_. **/
	public with_in_memory_project<T>(
		files: Record<string, string>,
		callback: (
			root: string,
			context: LintProjectContextContract,
			files: readonly string[],
			source_texts: Map<string, string>,
			stage_timer: LintStageTimerContract,
		) => T,
		configuration_overrides: ReadonlyMap<string, string>,
	): T {
		const root = `/virtual/ai-code-guard-project/${randomUUID()}`;
		const source_texts = new Map(Object.entries(files).map(([file, text]) => [resolve(root, file), text]));
		const source_paths = [...source_texts.keys()];
		const project_files = source_paths.filter((file) =>
			[".ts", ".tsx", ".py"].some((extension) => file.endsWith(extension)),
		);
		const worker = this.worker();
		const file_io = new NodeFileIO();
		const analysis_identity = new ProjectAnalysisIdentity(file_io);
		const context_factory = new LintProjectContextCreator(
			new PythonAstData({
				worker,
				analysis_identity,
				split_batch_enabled: true,
				file_io,
			}),
			analysis_identity,
			new InMemoryProjectSourceIO(source_texts),
			file_io,
		);
		const stage_timer = new LintStageTimer();
		const project_texts = new Map(source_texts);
		for (const [file, text] of configuration_overrides) {
			project_texts.set(resolve(root, file), text);
		}
		const context = context_factory.lint_context(root, project_files, stage_timer, project_texts, true);
		return callback(root, context, project_files, project_texts, stage_timer);
	}

	/** Responsibilities: _in-memory TypeScript source lookup_. **/
	public typescript_source_files(context: LintProjectContextContract): Map<string, ts.SourceFile> {
		return new Map(
			context
				.files()
				.filter((source) => source.typescript())
				.map((source) => [source.absolute_path, source.typescript_ast.source_file_node()] as const),
		);
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

	/** Responsibilities: _virtual source fixture creation_. **/
	public fixture(files: Record<string, string>): Fixture {
		const root = resolve(`/virtual/${this.placement_fixture_prefix}${randomUUID()}`);
		const source_texts = new Map(Object.entries(files).map(([file, text]) => [resolve(root, file), text]));
		return { root, paths: [...source_texts.keys()], source_texts };
	}

	/** Responsibilities: _in-memory source scanner fixture_. **/
	public source_scanner_fixture(
		files: Record<string, string>,
		entry_files: readonly string[] = [],
	): { root: string; scanner: ProjectSourceScanner; files: string[] } {
		return this.with_in_memory_project(
			files,
			(root, context, project_files) => ({
				root,
				scanner: new ProjectSourceScanner(root, {
					context_state: { available: true, value: context },
					entry_files,
				}),
				files: [...project_files],
			}),
			new Map(),
		);
	}

	/** Responsibilities: _project source analysis options_. **/
	public project_source_analysis_options(
		fixture: Fixture,
		context: LintProjectContextContract,
		ignored_files: ReadonlySet<string>,
	): ProjectSourceAnalysisOptions {
		return {
			root: fixture.root,
			project_files: fixture.paths,
			context,
			ignored_files,
			scanner: new ProjectSourceScanner(fixture.root, {
				context_state: { available: true, value: context },
				entry_files: [],
			}),
			files: new Set(fixture.paths),
		};
	}

	/** Responsibilities: _shared-parameter violations selection_. **/
	public shared_violations(violations: readonly ViolationContract[]): ViolationContract[] {
		const shared = violations.filter((violation) => violation.message.includes("share parameter"));
		if (shared.length === 0) {
			return [];
		}
		return [...shared];
	}
}
