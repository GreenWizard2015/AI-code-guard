import { resolve } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { ProjectSourceScanner } from "src/core/project-source/project_source_scanner";
import { UnusedCode } from "src/core/project-source/unused_code";
import { TestFixture } from "tests/core/test-fixture";

describe("unused code entry points", () => {
	const fixture = new TestFixture();

	test("recognizes Node TypeScript shebangs as entry points", () => {
		const project = fixture._project_source.source_scanner_fixture({
			"tools/coding-lint/cli.ts": '#!/usr/bin/env node\nexport { value } from "./dependency";\n',
			"tools/coding-lint/dependency.ts": "export const value = 1;\n",
			"tools/coding-lint/unused.ts": "export const unused = 1;\n",
		});
		const unused_code = new UnusedCode();
		const violations = unused_code.collect_scanner_violations(project.root, project.scanner, project.files);
		expect(violations.map((violation) => ({ file: violation.file(), rule_id: violation.rule_id() }))).toEqual([
			{ file: "tools/coding-lint/unused.ts", rule_id: "unused-file" },
		]);
	});

	test("recognizes named CLI modules as entry points without shebangs", () => {
		const project = fixture._project_source.source_scanner_fixture({
			"tools/coding-lint/cli.ts": 'import { value } from "./dependency";\nvoid value;\n',
			"tools/coding-lint/dependency.ts": "export const value = 1;\n",
			"tools/coding-lint/unused.ts": "export const unused = 1;\n",
			"src/cli.py": "start()\n",
		});
		const unused_code = new UnusedCode();
		const violations = unused_code.collect_scanner_violations(project.root, project.scanner, project.files);

		expect({
			ts_entry: project.scanner.project_source_entry().entry(resolve(project.root, "tools/coding-lint/cli.ts")),
			python_entry: project.scanner.project_source_entry().entry(resolve(project.root, "src/cli.py")),
			unused: violations.map((violation) => violation.file()),
		}).toEqual({
			ts_entry: true,
			python_entry: true,
			unused: ["tools/coding-lint/unused.ts"],
		});
	});

	test("treats configured test-directory modules as entry points", () => {
		const project = fixture._project_source.source_scanner_fixture({
			"tests/plugin_harness_contract.py":
				"from mcp_proxy.core.plugin.testing.plugin_test_assembly import PluginTestAssembly\n",
			"src/mcp_proxy/core/plugin/testing/plugin_test_assembly.py": "class PluginTestAssembly: pass\n",
		});
		const unused_code = new UnusedCode();
		const violations = unused_code.collect_scanner_violations(project.root, project.scanner, project.files);

		expect({
			entry: project.scanner.project_source_entry().entry(resolve(project.root, "tests/plugin_harness_contract.py")),
			unused: violations.map((violation) => violation.file()),
		}).toEqual({ entry: true, unused: [] });
	});

	test("recognizes root functions files as entry points", () => {
		const project = fixture._project_source.with_in_memory_project(
			{
				"functions.ts": "export const value = 1;\n",
				"functions.tsx": "export const value = 1;\n",
				"functions.py": "value = 1\n",
			},
			({ root, context, files }) => ({ root, context, files }),
			new Map(),
		);
		const scanner = new ProjectSourceScanner(project.root, {
			context_state: { available: true, value: project.context },
			entry_files: [],
		});
		const entries = scanner.files().map((file) => scanner.project_source_entry().entry(file));
		expect(entries).toEqual([true, true, true]);
	});

	test("keeps configured Python plugin modules and their imports reachable", () => {
		const project = fixture._project_source.source_scanner_fixture({
			"pyproject.toml": '[project.entry-points."example.plugins"]\nsample = "example.plugin:Plugin"\n',
			"src/example/plugin.py": "from example.dependency import Dependency\nclass Plugin(Dependency): pass\n",
			"src/example/dependency.py": "class Dependency: pass\n",
		});
		const unused_code = new UnusedCode();
		const violations = unused_code.collect_scanner_violations(project.root, project.scanner, project.files);

		expect(violations.filter((violation) => violation.rule_id() === "unused-file").map((item) => item.file())).toEqual(
			[],
		);
	});

	test("returns stable project-relative paths for repeated source lookups", () => {
		const project = fixture._project_source.with_in_memory_project(
			{ "src/main.ts": "export {};\n" },
			({ root, context }) => {
				const scanner = new ProjectSourceScanner(root, {
					context_state: { available: true, value: context },
					entry_files: [],
				});
				return { root, entry: scanner.project_source_entry() };
			},
			new Map(),
		);
		const source_file = resolve(project.root, "src/main.ts");
		const outside_file = resolve(project.root, "../outside.ts");

		expect({
			first_lookup: project.entry.relative_path(source_file),
			repeated_lookup: project.entry.relative_path(source_file),
			root_lookup: project.entry.relative_path(project.root),
			outside_lookup: project.entry.relative_path(outside_file),
		}).toEqual({
			first_lookup: "src/main.ts",
			repeated_lookup: "src/main.ts",
			root_lookup: ".",
			outside_lookup: "../outside.ts",
		});
	});
});
