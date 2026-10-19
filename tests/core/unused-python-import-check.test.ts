import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { describe, expect, jest, test } from "@jest/globals";
import { UnusedCode } from "src/core/unused_code";
import { ProjectSourceScanner } from "src/core/project-source/project_source_scanner";
import type { ProjectSourceOptions } from "src/model/types/types";
import { ProjectSourcePython } from "src/core/project-source/project_source_python";
import { TestFixture } from "tests/core/test-fixture";

describe("unused Python import checker", () => {
	test("caches Python import path parts for a stable file set", () => {
		const resolver = new ProjectSourcePython();
		const files = new Set(["/repo/tools/webmcp/module.py"]);
		const iterator = jest.spyOn(files, Symbol.iterator);

		expect({
			first_result: resolver.python_import("/repo", "tools.webmcp", files),
			second_result: resolver.python_import("/repo", "tools.webmcp.other", files),
			iterator_calls: iterator.mock.calls.length,
		}).toEqual({ first_result: true, second_result: true, iterator_calls: 1 });
	});

	test("reports unreachable Python files and follows relative imports", () => {
		const fixture = new TestFixture();
		const unused_code = new UnusedCode();
		const violations = fixture.with_in_memory_project(
			{
				"tools/coding-lint/entry.py": 'from .reachable import value\n\nif __name__ == "__main__":\n    print(value)\n',
				"tools/coding-lint/reachable.py": "value = 1\n",
				"tools/coding-lint/unused.py": "value = 2\n",
			},
			(root, context, files) => {
				const options: ProjectSourceOptions = {
					context_state: { available: true, value: context },
					entry_files: [],
				};
				const scanner = new ProjectSourceScanner(root, options);
				return unused_code.collect_scanner_violations(root, scanner, [...files]);
			},
			new Map(),
		);
		expect(violations.map((violation) => violation.file)).toEqual(["tools/coding-lint/unused.py"]);
	});

	test("keeps Python test files as entry points", () => {
		const fixture = new TestFixture();
		const unused_code = new UnusedCode();
		const violations = fixture.with_in_memory_project(
			{
				"tools/coding-lint/example.test.py": "def test_example():\n    assert True\n",
			},
			(root, context, files) => {
				const options: ProjectSourceOptions = {
					context_state: { available: true, value: context },
					entry_files: [],
				};
				const scanner = new ProjectSourceScanner(root, options);
				return unused_code.collect_scanner_violations(root, scanner, [...files]);
			},
			new Map(),
		);
		expect(violations).toEqual([]);
	});

	test("recognizes Python main guards as entry points", () => {
		const fixture = new TestFixture();
		const unused_code = new UnusedCode();
		const violations = fixture.with_in_memory_project(
			{
				"tools/webmcp_proxy.py":
					'from tools.webmcp.module import value\n\nif __name__ == "__main__":\n    print(value)\n',
				"tools/webmcp/__init__.py": "",
				"tools/webmcp/module.py": "value = 1\n",
			},
			(root, context, files) => {
				const options: ProjectSourceOptions = {
					context_state: { available: true, value: context },
					entry_files: [],
				};
				const scanner = new ProjectSourceScanner(root, options);
				return unused_code.collect_scanner_violations(root, scanner, [...files]);
			},
			new Map(),
		);
		expect(violations).toEqual([]);
	});

	test("does not treat an ordinary Python module as an entry point", () => {
		const fixture = new TestFixture();
		const unused_code = new UnusedCode();
		const violations = fixture.with_in_memory_project(
			{ "tools/webmcp/module.py": "value = 1\n" },
			(root, context, files) => {
				const options: ProjectSourceOptions = {
					context_state: { available: true, value: context },
					entry_files: [],
				};
				const scanner = new ProjectSourceScanner(root, options);
				return unused_code.collect_scanner_violations(root, scanner, [...files]);
			},
			new Map(),
		);
		expect(violations.map((violation) => violation.file)).toEqual(["tools/webmcp/module.py"]);
	});

	test("resolves Python sibling imports when reporting missing imports", () => {
		const fixture = new TestFixture();
		const unused_code = new UnusedCode();
		const violations = fixture.with_in_memory_project(
			{
				"tools/coding-lint/importer.py": "from .dependency import value\n",
				"tools/coding-lint/dependency.py": "value = 1\n",
			},
			(root, context, files) => {
				const options: ProjectSourceOptions = {
					context_state: { available: true, value: context },
					entry_files: ["tools/coding-lint/index.ts"],
				};
				const scanner = new ProjectSourceScanner(root, options);
				return unused_code.collect_scanner_violations(root, scanner, [...files]);
			},
			new Map(),
		);
		expect(violations.filter((item) => item.rule_id === "missing-import")).toEqual([]);
	});

	test("resolves Python absolute imports inside project packages", () => {
		const fixture = new TestFixture();
		const unused_code = new UnusedCode();
		const violations = fixture.with_in_memory_project(
			{
				"tools/coding-lint/index.py": "from webmcp.core.shared import value\n",
				"tools/webmcp/core/shared.py": "value = 1\n",
			},
			(root, context, files) => {
				const options: ProjectSourceOptions = {
					context_state: { available: true, value: context },
					entry_files: [],
				};
				const scanner = new ProjectSourceScanner(root, options);
				return unused_code.collect_scanner_violations(root, scanner, [...files]);
			},
			new Map(),
		);
		expect(violations.filter((item) => item.rule_id === "missing-import")).toEqual([]);
	});

	test("resolves Python absolute imports to package initializers", () => {
		const fixture = new TestFixture();
		const unused_code = new UnusedCode();
		const violations = fixture.with_in_memory_project(
			{
				"tools/coding-lint/index.py": "from webmcp.core.shared import value\n",
				"tools/webmcp/core/shared/__init__.py": "value = 1\n",
			},
			(root, context, files) => {
				const options: ProjectSourceOptions = {
					context_state: { available: true, value: context },
					entry_files: [],
				};
				const scanner = new ProjectSourceScanner(root, options);
				return unused_code.collect_scanner_violations(root, scanner, [...files]);
			},
			new Map(),
		);
		expect(violations.filter((item) => item.rule_id === "missing-import")).toEqual([]);
	});

	test("follows Python named submodule imports", () => {
		const fixture = new TestFixture();
		const unused_code = new UnusedCode();
		const violations = fixture.with_in_memory_project(
			{
				"tools/coding-lint/entry.py": "from package import worker\nworker.run()\n",
				"tools/coding-lint/package/__init__.py": "",
				"tools/coding-lint/package/worker.py": "def run() -> None:\n    pass\n",
				"tools/coding-lint/package/entry.py": "from . import sibling\nsibling.run()\n",
				"tools/coding-lint/package/sibling.py": "def run() -> None:\n    pass\n",
			},
			(root, context, files) => {
				const options: ProjectSourceOptions = {
					context_state: { available: true, value: context },
					entry_files: ["tools/coding-lint/entry.py", "tools/coding-lint/package/entry.py"],
				};
				const scanner = new ProjectSourceScanner(root, options);
				return unused_code.collect_scanner_violations(root, scanner, [...files]);
			},
			new Map(),
		);

		expect(violations).toEqual([]);
	});
});
