import { describe, expect, test } from "@jest/globals";

import { LintProjectContextCreator } from "src/core/lint_project_context_creator";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/source_text";
import { ModulePlacementAnalyzer } from "src/linting/orchestration/runtime/global-analysis/module_placement_analyzer";
import { LintStageTimer } from "src/lint_stage_timer";
import { TestFixture } from "tests/core/test-fixture";

describe("cross-language module placement lint", () => {
	test("reports a deep dependency in a Python production graph", () => {
		const test_fixture = new TestFixture();
		const file_io = new NodeFileIO();
		const context_factory = new LintProjectContextCreator(
			test_fixture.python_ast_data(),
			new ProjectAnalysisIdentity(file_io),
			new SourceText(),
			file_io,
		);

		const value = test_fixture.fixture({
			"a/c/b/parser.py": "class Parser:\n    pass\n",
			"a/c/service.py": "from .b.parser import Parser\nParser()\n",
			"a/view.py": "from .c.b.parser import Parser\nParser()\n",
		});
		const context = context_factory.lint_context(value.root, value.paths, new LintStageTimer(), value.source_texts);
		const analyzer = new ModulePlacementAnalyzer(
			test_fixture.project_source_analysis_options(value, context, new Set<string>()),
		);
		expect(analyzer.collect_violations().map((item) => item.file)).toEqual(["a/c/b/parser.py"]);
	});

	test("reports a dependency shared with one nested production importer", () => {
		const test_fixture = new TestFixture();
		const file_io = new NodeFileIO();
		const context_factory = new LintProjectContextCreator(
			test_fixture.python_ast_data(),
			new ProjectAnalysisIdentity(file_io),
			new SourceText(),
			file_io,
		);

		const value = test_fixture.fixture({
			"a/parser.ts": "export class Parser {}\n",
			"a/c/service.ts": "import { Parser } from '../parser';\nnew Parser();\n",
		});
		const context = context_factory.lint_context(value.root, value.paths, new LintStageTimer(), value.source_texts);
		const analyzer = new ModulePlacementAnalyzer(
			test_fixture.project_source_analysis_options(value, context, new Set<string>()),
		);
		expect(analyzer.collect_violations().map((item) => item.file)).toEqual(["a/parser.ts"]);
	});

	test("allows a focused folder for a root-level importer", () => {
		const test_fixture = new TestFixture();
		const file_io = new NodeFileIO();
		const context_factory = new LintProjectContextCreator(
			test_fixture.python_ast_data(),
			new ProjectAnalysisIdentity(file_io),
			new SourceText(),
			file_io,
		);

		const value = test_fixture.fixture({
			"a/parser.ts": "export class Parser {}\n",
			"service.ts": "import { Parser } from './a/parser';\nnew Parser();\n",
		});
		const context = context_factory.lint_context(value.root, value.paths, new LintStageTimer(), value.source_texts);
		const analyzer = new ModulePlacementAnalyzer(
			test_fixture.project_source_analysis_options(value, context, new Set<string>()),
		);
		expect(analyzer.collect_violations()).toEqual([]);
	});

	test("uses a different focused folder when the module name is a caller folder", () => {
		const test_fixture = new TestFixture();
		const file_io = new NodeFileIO();
		const context_factory = new LintProjectContextCreator(
			test_fixture.python_ast_data(),
			new ProjectAnalysisIdentity(file_io),
			new SourceText(),
			file_io,
		);

		const value = test_fixture.fixture({
			"a/parser/nested/parser.ts": "export class Parser {}\n",
			"a/parser/service.ts": "import { Parser } from './nested/parser';\nnew Parser();\n",
			"a/view.ts": "import { Parser } from './parser/nested/parser';\nnew Parser();\n",
		});
		const context = context_factory.lint_context(value.root, value.paths, new LintStageTimer(), value.source_texts);
		const analyzer = new ModulePlacementAnalyzer(
			test_fixture.project_source_analysis_options(value, context, new Set<string>()),
		);
		const violations = analyzer.collect_violations();
		const first_violation = violations[0];
		const message = first_violation.message;
		expect(message).toContain("Suggested location(s): a/parser.ts or a/focused/parser.ts");
		expect(message).toContain("Do not place the module in a directory ignored by Git.");
	});

	test("uses a Python package as the placement boundary", () => {
		const test_fixture = new TestFixture();
		const file_io = new NodeFileIO();
		const context_factory = new LintProjectContextCreator(
			test_fixture.python_ast_data(),
			new ProjectAnalysisIdentity(file_io),
			new SourceText(),
			file_io,
		);

		const value = test_fixture.fixture({
			"pkg/__init__.py": "",
			"pkg/core/shared.py": "class Shared:\n    pass\n",
			"pkg/core/service.py": "from .shared import Shared\nShared()\n",
			"launcher.py": "from pkg.core.shared import Shared\nShared()\n",
		});
		const context = context_factory.lint_context(value.root, value.paths, new LintStageTimer(), value.source_texts);
		const analyzer = new ModulePlacementAnalyzer(
			test_fixture.project_source_analysis_options(value, context, new Set<string>()),
		);
		expect(analyzer.collect_violations()).toEqual([]);
	});

	test("keeps the Python package prefix in placement guidance", () => {
		const test_fixture = new TestFixture();
		const file_io = new NodeFileIO();
		const context_factory = new LintProjectContextCreator(
			test_fixture.python_ast_data(),
			new ProjectAnalysisIdentity(file_io),
			new SourceText(),
			file_io,
		);

		const value = test_fixture.fixture({
			"pkg/__init__.py": "",
			"pkg/shared/service.py": "class Service:\n    pass\n",
			"pkg/shared/app/main.py": "from ..service import Service\nService()\n",
		});
		const context = context_factory.lint_context(value.root, value.paths, new LintStageTimer(), value.source_texts);
		const analyzer = new ModulePlacementAnalyzer(
			test_fixture.project_source_analysis_options(value, context, new Set<string>()),
		);
		const violations = analyzer.collect_violations();
		const violation = violations[0];

		expect(violation?.message).toContain("pkg/shared/app/service.py");
		expect(violation?.message).toContain("class Service -> pkg/shared/app/service.py");
	});
});
