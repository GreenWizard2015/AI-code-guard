import "src/core/lint_project_context_creator";
import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { ProjectTestTargetImportPaths } from "src/linting/orchestration/runtime/test-targets/project_test_target_import_paths";
import { TestFixture } from "tests/core/test-fixture";

describe("project test target link collection", () => {
	test("returns every resolver-confirmed production file linked by one test file", () => {
		const fixture = new TestFixture();
		const request = fixture.fixture_lint_request({
			"src/widget/domain/reader.ts": "export class Reader {}\n",
			"src/widget/domain/writer.ts": "export class Writer {}\n",
			"tests/widget/domain/widget.test.ts": [
				"import { Reader } from '../../../src/widget/domain/reader';",
				"import { Writer } from '../../../src/widget/domain/writer';",
				"new Reader();",
				"new Writer();",
			].join("\n"),
		});
		const configuration = new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd()));
		const execution = configuration.lint_report(request.options, request.mode);
		const resolver = new ProjectTestTargetImportPaths(request.options.repo_root, execution.context);
		const links = resolver.test_target_links();

		expect(links).toEqual([
			{
				test_file: "tests/widget/domain/widget.test.ts",
				production_files: ["src/widget/domain/reader.ts", "src/widget/domain/writer.ts"],
			},
		]);
	});

	test("orders test links by canonical test path", () => {
		const fixture = new TestFixture();
		const request = fixture.fixture_lint_request({
			"src/widget/domain/reader.ts": "export class Reader {}\n",
			"src/widget/domain/writer.ts": "export class Writer {}\n",
			"tests/widget/domain/z.test.ts": "import { Writer } from '../../../src/widget/domain/writer';\nnew Writer();\n",
			"tests/widget/domain/a.test.ts": "import { Reader } from '../../../src/widget/domain/reader';\nnew Reader();\n",
		});
		const configuration = new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd()));
		const execution = configuration.lint_report(request.options, request.mode);
		const resolver = new ProjectTestTargetImportPaths(request.options.repo_root, execution.context);
		const links = resolver.test_target_links();

		expect(links).toEqual([
			{ test_file: "tests/widget/domain/a.test.ts", production_files: ["src/widget/domain/reader.ts"] },
			{ test_file: "tests/widget/domain/z.test.ts", production_files: ["src/widget/domain/writer.ts"] },
		]);
	});

	test("omits tests with only type-only production imports", () => {
		const fixture = new TestFixture();
		const request = fixture.fixture_lint_request({
			"src/widget/domain/reader.ts": "export class Reader {}\n",
			"tests/widget/domain/reader.test.ts": [
				"import type { Reader } from '../../../src/widget/domain/reader';",
				"const reader: Reader | undefined = undefined;",
			].join("\n"),
		});
		const configuration = new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd()));
		const execution = configuration.lint_report(request.options, request.mode);
		const resolver = new ProjectTestTargetImportPaths(request.options.repo_root, execution.context);
		const links = resolver.test_target_links();

		expect(links).toEqual([]);
	});
});
