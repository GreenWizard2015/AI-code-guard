import "src/bridge/ts/core/context-factory";
import "src/stage-timing";
import { describe, expect, test } from "@jest/globals";
import { LintProjectContextCreator } from "src/bridge/ts/core/context-factory";
import { ProductionTestImportAnalyzer } from "src/bridge/ts/runner/orchestration/runtime/production-test-import";
import { LintStageTimer } from "src/stage-timing";
import { TestFixture } from "tests/core/test-fixture";

describe("production test import lint", () => {
	test("reports a TypeScript production import of a test file", () => {
		const test_fixture = new TestFixture();
		const context_factory = new LintProjectContextCreator();
		const value = test_fixture.fixture({
			"src/service.ts": "import { helper } from '../tests/support/helper';\nhelper();\n",
			"tests/support/helper.ts": "export const helper = (): void => {};\n",
		});
		const context = context_factory.lint_context(value.root, value.paths, new LintStageTimer());
		const analyzer = new ProductionTestImportAnalyzer(value.root, value.paths, context, new Set<string>());

		const violations = analyzer.collect_violations();

		expect(violations.map((item) => ({ file: item.file, rule_id: item.rule_id, message: item.message }))).toEqual([
			{
				file: "src/service.ts",
				rule_id: "production-test-import",
				message: "production file imports test file tests/support/helper.ts",
			},
		]);
	});

	test("reports a Python production import of a test file", () => {
		const test_fixture = new TestFixture();
		const context_factory = new LintProjectContextCreator();
		const value = test_fixture.fixture({
			"src/service.py": "from tests.support.helper import helper\nhelper()\n",
			"tests/support/helper.py": "def helper() -> None:\n    pass\n",
		});
		const context = context_factory.lint_context(value.root, value.paths, new LintStageTimer());
		const analyzer = new ProductionTestImportAnalyzer(value.root, value.paths, context, new Set<string>());

		expect(analyzer.collect_violations().map((item) => item.rule_id)).toEqual(["production-test-import"]);
	});

	test("allows a test import of a production file", () => {
		const test_fixture = new TestFixture();
		const context_factory = new LintProjectContextCreator();
		const value = test_fixture.fixture({
			"src/service.ts": "export const service = (): void => {};\n",
			"tests/service.test.ts": "import { service } from '../src/service';\nservice();\n",
		});
		const context = context_factory.lint_context(value.root, value.paths, new LintStageTimer());
		const analyzer = new ProductionTestImportAnalyzer(value.root, value.paths, context, new Set<string>());

		expect(analyzer.collect_violations()).toEqual([]);
	});
});
