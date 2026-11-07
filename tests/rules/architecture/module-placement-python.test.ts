import { describe, expect, test } from "@jest/globals";

import { ModulePlacementAnalyzer } from "src/rules/architecture/module_placement_analyzer";
import { TestFixture } from "tests/core/test-fixture";

describe("cross-language module placement lint", () => {
	test("ignores runtime module targets that have no analyzed source record", () => {
		const test_fixture = new TestFixture();
		const options = test_fixture._project_source.with_in_memory_project(
			{
				"a/consumer.ts": "import worker from './worker.mjs';\nvoid worker;\n",
				"a/worker.mjs": "export default {};\n",
			},
			({ root, context, files, source_texts }) => {
				const source_options = test_fixture._project_source.project_source_analysis_options(
					{ root, paths: [...files], source_texts },
					context,
					new Set<string>(),
				);
				return {
					...source_options,
					files: new Set([...source_options.files, `${root}/a/worker.mjs`]),
				};
			},
			new Map(),
		);
		const analyzer = new ModulePlacementAnalyzer(options);
		const importers = analyzer.collect_importers();

		expect(analyzer.collect_language_violations(importers, "typescript")).toEqual([]);
	});

	test("reports a deep dependency in a Python production graph", () => {
		const test_fixture = new TestFixture();
		const options = test_fixture._project_source.with_in_memory_project(
			{
				"a/c/b/parser.py": "class Parser:\n    pass\n",
				"a/c/service.py": "from .b.parser import Parser\nParser()\n",
				"a/view.py": "from .c.b.parser import Parser\nParser()\n",
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
		expect(
			analyzer.collect_language_violations(analyzer.collect_importers(), "python").map((item) => item.file()),
		).toEqual(["a/c/b/parser.py"]);
	});

	test("reports a dependency shared with one nested production importer", () => {
		const test_fixture = new TestFixture();
		const options = test_fixture._project_source.with_in_memory_project(
			{
				"a/parser.ts": "export class Parser {}\n",
				"a/c/service.ts": "import { Parser } from '../parser';\nnew Parser();\n",
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
		expect(
			analyzer.collect_language_violations(analyzer.collect_importers(), "typescript").map((item) => item.file()),
		).toEqual(["a/parser.ts"]);
	});

	test("allows a focused folder for a root-level importer", () => {
		const test_fixture = new TestFixture();
		const options = test_fixture._project_source.with_in_memory_project(
			{
				"a/parser.ts": "export class Parser {}\n",
				"service.ts": "import { Parser } from './a/parser';\nnew Parser();\n",
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
		expect(analyzer.collect_language_violations(analyzer.collect_importers(), "typescript")).toEqual([]);
	});

	test("uses a different focused folder when the module name is a caller folder", () => {
		const test_fixture = new TestFixture();
		const options = test_fixture._project_source.with_in_memory_project(
			{
				"a/parser/nested/parser.ts": "export class Parser {}\n",
				"a/parser/service.ts": "import { Parser } from './nested/parser';\nnew Parser();\n",
				"a/view.ts": "import { Parser } from './parser/nested/parser';\nnew Parser();\n",
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
		const messages = violations.map((violation) => violation.message());

		expect({
			count: violations.length,
			suggested_location: messages.some((message) =>
				message.includes("Suggested location(s): a/parser.ts or a/focused/parser.ts"),
			),
			git_warning: messages.some((message) =>
				message.includes("Do not place the module in a directory ignored by Git."),
			),
		}).toEqual({ count: 1, suggested_location: true, git_warning: true });
	});

	test("uses a Python package as the placement boundary", () => {
		const test_fixture = new TestFixture();
		const options = test_fixture._project_source.with_in_memory_project(
			{
				"pkg/__init__.py": "",
				"pkg/core/shared.py": "class Shared:\n    pass\n",
				"pkg/core/service.py": "from .shared import Shared\nShared()\n",
				"launcher.py": "from pkg.core.shared import Shared\nShared()\n",
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
		expect(analyzer.collect_language_violations(analyzer.collect_importers(), "python")).toEqual([]);
	});

	test("keeps the Python package prefix in placement guidance", () => {
		const test_fixture = new TestFixture();
		const options = test_fixture._project_source.with_in_memory_project(
			{
				"pkg/__init__.py": "",
				"pkg/shared/service.py": "class Service:\n    pass\n",
				"pkg/shared/app/main.py": "from ..service import Service\nService()\n",
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
		const violations = analyzer.collect_language_violations(analyzer.collect_importers(), "python");
		const messages = violations.map((violation) => violation.message());

		expect({
			path_reported: messages.some((message) => message.includes("pkg/shared/app/service.py")),
			class_location_reported: messages.some((message) =>
				message.includes("class Service -> pkg/shared/app/service.py"),
			),
		}).toEqual({ path_reported: true, class_location_reported: true });
	});
});
