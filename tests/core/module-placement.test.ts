import { describe, expect, test } from "@jest/globals";
import { LintProjectContextCreator } from "src/core/lint_project_context_creator";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

import { LintStageTimer } from "src/lint_stage_timer";
import { ModulePlacementAnalyzer } from "src/rules/architecture/module_placement_analyzer";

describe("module placement lint", () => {
	test("reports a deep dependency nested under a caller directory", () => {
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
			"a/c/b/decoder.ts": "export class Decoder {}\n",
			"a/c/service.ts":
				"import { Parser } from './b/parser';\nimport { Decoder } from './b/decoder';\nnew Parser();\nnew Decoder();\n",
			"a/view.ts":
				"import { Parser } from './c/b/parser';\nimport { Decoder } from './c/b/decoder';\nnew Parser();\nnew Decoder();\n",
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
		const options = test_fixture._project_source.project_source_analysis_options(value, context, new Set<string>());
		const analyzer = new ModulePlacementAnalyzer(options);
		const violations = analyzer.collect_language_violations(analyzer.collect_importers(), "typescript");
		const messages = violations.map((item) => item.message());
		const hints = violations.map((item) => item.hint());
		expect({
			files: violations.map((item) => item.file()),
			message: messages.some((message) => message.includes("class Parser")),
			hint: hints.some((hint) => hint.includes("class Parser")),
		}).toEqual({
			files: ["a/c/b/parser.ts", "a/c/b/decoder.ts"],
			message: true,
			hint: true,
		});
	});

	test("reports focused destinations for every exported member kind", () => {
		const test_fixture = new TestFixture();
		const file_io = new NodeFileIO(process.cwd());
		const context_factory = new LintProjectContextCreator(
			test_fixture.python_ast_data(),
			new ProjectAnalysisIdentity(file_io),
			new SourceText(),
			file_io,
		);

		const value = test_fixture.fixture({
			"a/c/b/parser.ts": [
				"export class Parser {}",
				"export const CACHE_VALUE = 1;",
				"export type ParserOptions = { value: string };",
				"export interface ParserContract { parse(): string; }",
				"export function parse_parser(): Parser { return new Parser(); }",
			].join("\n"),
			"a/c/service.ts":
				"import { Parser, CACHE_VALUE, ParserOptions, ParserContract, parse_parser } from './b/parser';\nvoid Parser; void CACHE_VALUE; void ParserOptions; void ParserContract; void parse_parser;\n",
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
		const analyzer = new ModulePlacementAnalyzer(
			test_fixture._project_source.project_source_analysis_options(value, context, new Set<string>()),
		);
		const violations = analyzer.collect_language_violations(analyzer.collect_importers(), "typescript");
		const first_violation = violations[0];
		let message = "";
		if (first_violation !== undefined) {
			message = first_violation.message();
		}

		expect({
			class_destination: message.includes("class Parser -> a/parser.ts or a/parser/parser.ts"),
			constant_destination: message.includes("constant CACHE_VALUE -> a/constants.ts"),
			type_destination: message.includes("type ParserOptions -> a/types.ts"),
			interface_destination: message.includes("interface ParserContract -> a/types.ts"),
			function_destination: message.includes("function parse_parser -> functions.ts"),
		}).toEqual({
			class_destination: true,
			constant_destination: true,
			type_destination: true,
			interface_destination: true,
			function_destination: true,
		});
	});

	test("allows a focused folder distinct from caller folders", () => {
		const test_fixture = new TestFixture();
		const file_io = new NodeFileIO(process.cwd());
		const context_factory = new LintProjectContextCreator(
			test_fixture.python_ast_data(),
			new ProjectAnalysisIdentity(file_io),
			new SourceText(),
			file_io,
		);

		const value = test_fixture.fixture({
			"a/feature/parser/parser.ts": "export class Parser {}\n",
			"a/feature/service.ts": "import { Parser } from './parser/parser';\nnew Parser();\n",
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

	test("ignores imported runtime modules outside the linted source inventory", () => {
		const test_fixture = new TestFixture();
		const file_io = new NodeFileIO(process.cwd());
		const context_factory = new LintProjectContextCreator(
			test_fixture.python_ast_data(),
			new ProjectAnalysisIdentity(file_io),
			new SourceText(),
			file_io,
		);
		const value = test_fixture.fixture({
			"a/service.ts": 'import { PythonAstWorker } from "../core/python-ast-worker.mjs";\nvoid PythonAstWorker;\n',
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

	test("allows a populated domain directory below a shared importer boundary", () => {
		const test_fixture = new TestFixture();
		const file_io = new NodeFileIO(process.cwd());
		const context_factory = new LintProjectContextCreator(
			test_fixture.python_ast_data(),
			new ProjectAnalysisIdentity(file_io),
			new SourceText(),
			file_io,
		);

		const value = test_fixture.fixture({
			"a/core/parsers/parser.ts": "export class Parser {}\n",
			"a/core/parsers/parser_state.ts": "export class ParserState {}\n",
			"a/core/parsers/parser_nodes.ts": "export class ParserNodes {}\n",
			"a/service/service.ts": "import { Parser } from '../../core/parsers/parser';\nnew Parser();\n",
			"a/view/view.ts": "import { Parser } from '../../core/parsers/parser';\nnew Parser();\n",
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

		expect(
			analyzer.collect_language_violations(analyzer.collect_importers(), "typescript").map((item) => item.file()),
		).toEqual([]);
	});

	test("allows a populated domain directory directly below its importer boundary", () => {
		const test_fixture = new TestFixture();
		const file_io = new NodeFileIO(process.cwd());
		const context_factory = new LintProjectContextCreator(
			test_fixture.python_ast_data(),
			new ProjectAnalysisIdentity(file_io),
			new SourceText(),
			file_io,
		);
		const value = test_fixture.fixture({
			"a/core/service.ts": "import { Parser } from './parsers/parser';\nnew Parser();\n",
			"a/core/parsers/parser.ts": "export class Parser {}\n",
			"a/core/parsers/parser_state.ts": "export class ParserState {}\n",
			"a/core/parsers/parser_nodes.ts": "export class ParserNodes {}\n",
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

		expect(
			analyzer.collect_language_violations(analyzer.collect_importers(), "typescript").map((item) => item.file()),
		).toEqual([]);
	});

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
