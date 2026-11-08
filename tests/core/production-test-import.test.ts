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
	test("reports TypeScript production imports and allows tests to import production", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"src/consumer.ts": "import { helper } from '../tests/support/helper'; helper();",
				"tests/support/helper.ts": "export const helper = (): void => {};",
				"src/require-consumer.ts": "import helper = require('../tests/support/equal-helper'); helper.run();",
				"tests/support/equal-helper.ts": "export const helper = { run: (): void => {} };",
				"src/service.ts": "export const service = (): void => {};",
				"tests/service.test.ts": "import { service } from '../src/service'; service();",
			},
			(configuration, options, mode) => configuration.lint_report(options, mode).report.violations,
		);
		const production_imports = violations
			.filter((violation) => violation.rule_id() === "production-test-import")
			.map((violation) => ({
				file: violation.file(),
				rule_id: violation.rule_id(),
				message: violation.message(),
			}))
			.sort((left, right) => left.file.localeCompare(right.file));

		expect({
			production_imports,
			test_to_production_reported: violations.some(
				(violation) => violation.rule_id() === "production-test-import" && violation.file() === "tests/service.test.ts",
			),
		}).toEqual({
			production_imports: [
				{
					file: "src/consumer.ts",
					rule_id: "production-test-import",
					message: "production file imports test file tests/support/helper.ts",
				},
				{
					file: "src/require-consumer.ts",
					rule_id: "production-test-import",
					message: "production file imports test file tests/support/equal-helper.ts",
				},
			],
			test_to_production_reported: false,
		});
	});

	test("reports Python production imports of test modules and submodules", () => {
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
			"src/submodule_service.py": "from tests.support import helper\nhelper.run()\n",
			"tests/support/__init__.py": "",
			"tests/support/helper.py": "def helper() -> None:\n    pass\n\ndef run() -> None:\n    pass\n",
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
		const python_imports = analyzer
			.language_violations("python")
			.filter((violation) => violation.rule_id() === "production-test-import")
			.map((violation) => `${violation.file()}:${violation.line()}`)
			.sort();

		expect(python_imports).toEqual(["src/service.py:1", "src/submodule_service.py:1"]);
	});
});
