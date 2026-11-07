import { describe, expect, test } from "@jest/globals";
import { LintProjectContextCreator } from "src/core/lint_project_context_creator";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { LintStageTimer } from "src/lint_stage_timer";
import { ProductionTestImportAnalyzer } from "src/rules/architecture/production_test_import_analyzer";
import { TestFixture } from "tests/core/test-fixture";

describe("production test import lint", () => {
	test("routes TypeScript project import findings through the AST verifier", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"src/service.ts": "import { helper } from '../tests/support/helper'; helper();",
				"tests/support/helper.ts": "export const helper = (): void => {};",
			},
			(configuration, options, mode) => configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((violation) => violation.rule_id() === "production-test-import")
				.map((violation) => [violation.file(), violation.rule_id()]),
		).toEqual([["src/service.ts", "production-test-import"]]);
	});

	test("reports a TypeScript production import of a test file", () => {
		const test_fixture = new TestFixture();
		const file_io = new NodeFileIO(process.cwd());
		const context_factory = new LintProjectContextCreator(
			test_fixture.python_ast_data(),
			new ProjectAnalysisIdentity(file_io),
			new SourceText(),
			file_io,
		);
		const value = test_fixture.fixture({
			"src/service.ts": "import { helper } from '../tests/support/helper';\nhelper();\n",
			"tests/support/helper.ts": "export const helper = (): void => {};\n",
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
		const analyzer = new ProductionTestImportAnalyzer(
			test_fixture._project_source.project_source_analysis_options(value, context, new Set<string>()),
		);

		const violations = analyzer.language_violations("typescript");

		expect(violations.map((item) => ({ file: item.file(), rule_id: item.rule_id(), message: item.message() }))).toEqual(
			[
				{
					file: "src/service.ts",
					rule_id: "production-test-import",
					message: "production file imports test file tests/support/helper.ts",
				},
			],
		);
	});

	test("reports a TypeScript import-equals production import of a test file", () => {
		const test_fixture = new TestFixture();
		const file_io = new NodeFileIO(process.cwd());
		const context_factory = new LintProjectContextCreator(
			test_fixture.python_ast_data(),
			new ProjectAnalysisIdentity(file_io),
			new SourceText(),
			file_io,
		);
		const value = test_fixture.fixture({
			"src/service.ts": "import helper = require('../tests/support/helper');\nhelper.run();\n",
			"tests/support/helper.ts": "export const run = (): void => {};\n",
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
		const analyzer = new ProductionTestImportAnalyzer(
			test_fixture._project_source.project_source_analysis_options(value, context, new Set<string>()),
		);

		expect(analyzer.language_violations("typescript").map((item) => item.rule_id())).toEqual([
			"production-test-import",
		]);
	});

	test("reports a Python production import of a test file", () => {
		const test_fixture = new TestFixture();
		const file_io = new NodeFileIO(process.cwd());
		const context_factory = new LintProjectContextCreator(
			test_fixture.python_ast_data(),
			new ProjectAnalysisIdentity(file_io),
			new SourceText(),
			file_io,
		);
		const value = test_fixture.fixture({
			"src/service.py": "from tests.support.helper import helper\nhelper()\n",
			"tests/support/helper.py": "def helper() -> None:\n    pass\n",
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
		const analyzer = new ProductionTestImportAnalyzer(
			test_fixture._project_source.project_source_analysis_options(value, context, new Set<string>()),
		);

		expect(analyzer.language_violations("python").map((item) => item.rule_id())).toEqual(["production-test-import"]);
	});

	test("reports a Python named submodule test import", () => {
		const test_fixture = new TestFixture();
		const file_io = new NodeFileIO(process.cwd());
		const context_factory = new LintProjectContextCreator(
			test_fixture.python_ast_data(),
			new ProjectAnalysisIdentity(file_io),
			new SourceText(),
			file_io,
		);
		const value = test_fixture.fixture({
			"src/service.py": "from tests.support import helper\nhelper.run()\n",
			"tests/support/__init__.py": "",
			"tests/support/helper.py": "def run() -> None:\n    pass\n",
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
		const analyzer = new ProductionTestImportAnalyzer(
			test_fixture._project_source.project_source_analysis_options(value, context, new Set<string>()),
		);

		expect(analyzer.language_violations("python").map((item) => item.rule_id())).toEqual(["production-test-import"]);
	});

	test("allows a test import of a production file", () => {
		const test_fixture = new TestFixture();
		const file_io = new NodeFileIO(process.cwd());
		const context_factory = new LintProjectContextCreator(
			test_fixture.python_ast_data(),
			new ProjectAnalysisIdentity(file_io),
			new SourceText(),
			file_io,
		);
		const value = test_fixture.fixture({
			"src/service.ts": "export const service = (): void => {};\n",
			"tests/service.test.ts": "import { service } from '../src/service';\nservice();\n",
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
		const analyzer = new ProductionTestImportAnalyzer(
			test_fixture._project_source.project_source_analysis_options(value, context, new Set<string>()),
		);

		expect(analyzer.language_violations("typescript")).toEqual([]);
	});
});
