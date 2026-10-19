import { describe, expect, test } from "@jest/globals";
import { LintProjectContextCreator } from "src/core/lint_project_context_creator";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/source_text";
import { ProductionTestImportAnalyzer } from "src/linting/orchestration/runtime/global-analysis/production_test_import_analyzer";
import { LintStageTimer } from "src/lint_stage_timer";
import { TestFixture } from "tests/core/test-fixture";

describe("production test import lint", () => {
	test("reports a TypeScript production import of a test file", () => {
		const test_fixture = new TestFixture();
		const file_io = new NodeFileIO();
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
		const context = context_factory.lint_context(value.root, value.paths, new LintStageTimer(), value.source_texts);
		const analyzer = new ProductionTestImportAnalyzer(
			test_fixture.project_source_analysis_options(value, context, new Set<string>()),
		);

		const violations = analyzer.collect_violations();

		expect(violations.map((item) => ({ file: item.file, rule_id: item.rule_id, message: item.message }))).toEqual([
			{
				file: "src/service.ts",
				rule_id: "production-test-import",
				message: "production file imports test file tests/support/helper.ts",
			},
		]);
	});

	test("reports a TypeScript import-equals production import of a test file", () => {
		const test_fixture = new TestFixture();
		const file_io = new NodeFileIO();
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
		const context = context_factory.lint_context(value.root, value.paths, new LintStageTimer(), value.source_texts);
		const analyzer = new ProductionTestImportAnalyzer(
			test_fixture.project_source_analysis_options(value, context, new Set<string>()),
		);

		expect(analyzer.collect_violations().map((item) => item.rule_id)).toEqual(["production-test-import"]);
	});

	test("reports a Python production import of a test file", () => {
		const test_fixture = new TestFixture();
		const file_io = new NodeFileIO();
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
		const context = context_factory.lint_context(value.root, value.paths, new LintStageTimer(), value.source_texts);
		const analyzer = new ProductionTestImportAnalyzer(
			test_fixture.project_source_analysis_options(value, context, new Set<string>()),
		);

		expect(analyzer.collect_violations().map((item) => item.rule_id)).toEqual(["production-test-import"]);
	});

	test("reports a Python named submodule test import", () => {
		const test_fixture = new TestFixture();
		const file_io = new NodeFileIO();
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
		const context = context_factory.lint_context(value.root, value.paths, new LintStageTimer(), value.source_texts);
		const analyzer = new ProductionTestImportAnalyzer(
			test_fixture.project_source_analysis_options(value, context, new Set<string>()),
		);

		expect(analyzer.collect_violations().map((item) => item.rule_id)).toEqual(["production-test-import"]);
	});

	test("allows a test import of a production file", () => {
		const test_fixture = new TestFixture();
		const file_io = new NodeFileIO();
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
		const context = context_factory.lint_context(value.root, value.paths, new LintStageTimer(), value.source_texts);
		const analyzer = new ProductionTestImportAnalyzer(
			test_fixture.project_source_analysis_options(value, context, new Set<string>()),
		);

		expect(analyzer.collect_violations()).toEqual([]);
	});
});
