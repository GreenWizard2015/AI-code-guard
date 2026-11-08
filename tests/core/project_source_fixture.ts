import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { NODE_ENV_VARIABLE } from "src/core/constants";
import { LintProjectContextCreator } from "src/core/lint_project_context_creator";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import { ProjectSourceScanner } from "src/core/project-source/project_source_scanner";
import { PythonAstData } from "src/core/python-ast/python_ast_data";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { LintStageTimer } from "src/lint_stage_timer";
import type { ProjectSourceAnalysisOptions } from "src/project_analysis_types";
import type { LintProjectContextContract } from "src/shared_services_protocols";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import type { CallableProjectSourceAction, CallablePythonAstWorkerProvider, Fixture } from "tests/core/types";
import type ts from "typescript";

/** Responsibilities: _in-memory project contexts_, _source graph fixtures_. **/
export class ProjectSourceFixture {
	private readonly _python_ast_worker_provider: CallablePythonAstWorkerProvider;
	private readonly placement_fixture_prefix = "module-placement-";

	/** Responsibilities: _source graph fixture initialization_. **/
	public constructor(worker_provider: CallablePythonAstWorkerProvider) {
		this._python_ast_worker_provider = worker_provider;
	}

	/** Responsibilities: _in-memory project context creation_, _Python worker reuse_. **/
	public with_in_memory_project<T>(
		files: Record<string, string>,
		callback: CallableProjectSourceAction<T>,
		configuration_overrides: ReadonlyMap<string, string>,
	): T {
		const root = `/virtual/ai-code-guard-project/${randomUUID()}`;
		const source_texts = new Map(Object.entries(files).map(([file, text]) => [resolve(root, file), text]));
		const source_paths = [...source_texts.keys()];
		const project_files = source_paths.filter((file) =>
			[".ts", ".tsx", ".py"].some((extension) => file.endsWith(extension)),
		);
		const stage_timer = new LintStageTimer();
		const project_texts = new Map(source_texts);
		for (const [file, text] of configuration_overrides) {
			project_texts.set(resolve(root, file), text);
		}
		const file_io = new InMemoryFileIO();
		file_io.seed_files(project_texts);
		const analysis_identity = new ProjectAnalysisIdentity(file_io);
		const context_factory = new LintProjectContextCreator(
			new PythonAstData({
				worker: this._python_ast_worker_provider(),
				analysis_identity: analysis_identity,
				split_batch_enabled: true,
				file_io: file_io,
				cache_enabled: process.env[NODE_ENV_VARIABLE] !== "test",
			}),
			analysis_identity,
			new InMemoryProjectSourceIO(source_texts),
			file_io,
		);
		const context = context_factory.lint_context(
			context_factory.snapshot({
				repo_root: root,
				project_files: project_files,
				ignore_files: [],
				stage_timer: stage_timer,
				source_texts: project_texts,
				in_memory: true,
				configuration_snapshot_complete: false,
			}),
		);
		return callback({
			root,
			context,
			files: project_files,
			source_texts: project_texts,
			stage_timer,
		});
	}

	/** Responsibilities: _project TypeScript ASTs_. **/
	public typescript_source_files(context: LintProjectContextContract): Map<string, ts.SourceFile> {
		return new Map(
			context
				.files()
				.filter((source) => source.language === "typescript")
				.map((source) => [source.absolute_path, source.typescript_ast.source_file_node()] as const),
		);
	}

	/** Responsibilities: _source scanner fixture assembly_. **/
	public source_scanner_fixture(
		files: Record<string, string>,
		entry_files: readonly string[] = [],
	): { root: string; scanner: ProjectSourceScanner; files: string[] } {
		return this.with_in_memory_project(
			files,
			({ root, context, files: project_files }) => ({
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

	/** Responsibilities: _source analysis options_. **/
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
			file_io: new InMemoryFileIO(),
			directory_files: { virtual_project: true, files: fixture.paths },
		};
	}

	/** Responsibilities: _virtual source snapshot creation_. **/
	public fixture(files: Record<string, string>): Fixture {
		const root = resolve(`/virtual/${this.placement_fixture_prefix}${randomUUID()}`);
		const source_texts = new Map(Object.entries(files).map(([file, text]) => [resolve(root, file), text]));
		return { root, paths: [...source_texts.keys()], source_texts };
	}
}
