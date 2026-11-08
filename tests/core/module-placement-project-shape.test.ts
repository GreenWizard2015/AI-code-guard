import { describe, expect, test } from "@jest/globals";
import { LintProjectContextCreator } from "src/core/lint_project_context_creator";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { LintStageTimer } from "src/lint_stage_timer";
import { ModulePlacementAnalyzer } from "src/rules/architecture/module_placement_analyzer";
import { TestFixture } from "tests/core/test-fixture";

describe("module placement project shape and ignore handling", () => {
	test("skips ignored modules and their importer edges", () => {
		const test_fixture = new TestFixture();
		const file_io = new NodeFileIO(process.cwd());
		const context_factory = new LintProjectContextCreator(
			test_fixture.python_ast_data(),
			new ProjectAnalysisIdentity(file_io),
			new SourceText(),
			file_io,
		);

		const value = test_fixture.fixture({
			"a/c/b/parser.ts": "export class Parser {}\n",
			"a/c/service.ts": "import { Parser } from './b/parser';\nnew Parser();\n",
			"a/view.ts": "import { Parser } from './c/b/parser';\nnew Parser();\n",
		});
		const context = context_factory.lint_context(
			context_factory.snapshot({
				repo_root: value.root,
				project_files: value.paths,
				ignore_files: [],
				stage_timer: new LintStageTimer(),
				source_texts: value.source_texts,
				in_memory: true,
				configuration_snapshot_complete: false,
			}),
		);
		const ignored_files = new Set(value.paths.filter((path) => path.endsWith("parser.ts")));
		const analyzer = new ModulePlacementAnalyzer(
			test_fixture._project_source.project_source_analysis_options(value, context, ignored_files),
		);

		expect(analyzer.collect_language_violations(analyzer.collect_importers(), "typescript")).toEqual([]);
	});

	test("uses the importer directory as the common path for one importer", () => {
		const test_fixture = new TestFixture();
		const file_io = new NodeFileIO(process.cwd());
		const context_factory = new LintProjectContextCreator(
			test_fixture.python_ast_data(),
			new ProjectAnalysisIdentity(file_io),
			new SourceText(),
			file_io,
		);

		const value = test_fixture.fixture({
			"x/h.ts": "export class Handler {}\n",
			"a/b/c/d.ts": "import { Handler } from '../../../x/h';\nnew Handler();\n",
		});
		const context = context_factory.lint_context(
			context_factory.snapshot({
				repo_root: value.root,
				project_files: value.paths,
				ignore_files: [],
				stage_timer: new LintStageTimer(),
				source_texts: value.source_texts,
				in_memory: true,
				configuration_snapshot_complete: false,
			}),
		);
		const analyzer = new ModulePlacementAnalyzer(
			test_fixture._project_source.project_source_analysis_options(value, context, new Set<string>()),
		);
		const violations = analyzer.collect_language_violations(analyzer.collect_importers(), "typescript");
		const messages = violations.map((violation) => violation.message());

		expect({
			files: violations.map((violation) => violation.file()),
			suggested_location: messages.some((message) =>
				message.includes("Suggested location(s): a/b/c/h.ts or a/b/c/h/h.ts"),
			),
		}).toEqual({ files: ["x/h.ts"], suggested_location: true });
	});

	test("does not use a test-only importer as evidence", () => {
		const test_fixture = new TestFixture();
		const file_io = new NodeFileIO(process.cwd());
		const context_factory = new LintProjectContextCreator(
			test_fixture.python_ast_data(),
			new ProjectAnalysisIdentity(file_io),
			new SourceText(),
			file_io,
		);

		const value = test_fixture.fixture({
			"a/parser.ts": "export class Parser {}\n",
			"a/c/parser.test.ts": "import { Parser } from '../parser';\nnew Parser();\n",
		});
		const context = context_factory.lint_context(
			context_factory.snapshot({
				repo_root: value.root,
				project_files: value.paths,
				ignore_files: [],
				stage_timer: new LintStageTimer(),
				source_texts: value.source_texts,
				in_memory: true,
				configuration_snapshot_complete: false,
			}),
		);
		const analyzer = new ModulePlacementAnalyzer(
			test_fixture._project_source.project_source_analysis_options(value, context, new Set<string>()),
		);
		expect(analyzer.collect_language_violations(analyzer.collect_importers(), "typescript")).toEqual([]);
	});

	test.each([".ts", ".tsx", ".mts", ".cts"])("counts %s siblings for placement grouping", (extension) => {
		const test_fixture = new TestFixture();
		const options = test_fixture._project_source.with_in_memory_project(
			{
				[`a/shared/worker${extension}`]: "export class Worker {}\n",
				[`a/shared/worker_state${extension}`]: "export class WorkerState {}\n",
				[`a/shared/worker_nodes${extension}`]: "export class WorkerNodes {}\n",
				[`a/client/one${extension}`]: 'import { Worker } from "../shared/worker";\nnew Worker();\n',
				[`b/shared/two${extension}`]: 'import { Worker } from "../../a/shared/worker";\nnew Worker();\n',
			},
			({ root, context, files, source_texts }) =>
				test_fixture._project_source.project_source_analysis_options(
					{ root, paths: [...files], source_texts },
					context,
					new Set<string>(),
				),
			new Map(),
		);
		const analyzer = new ModulePlacementAnalyzer(options);
		const violations = analyzer.collect_language_violations(analyzer.collect_importers(), "typescript");

		expect(violations.map((violation) => violation.file())).toEqual([]);
	});
});
