import { describe, expect, test } from "@jest/globals";
import { resolve } from "node:path";
import { ProjectSourceScanner } from "src/core/project-source/project_source_scanner";
import { UnusedCode } from "src/core/project-source/unused_code";
import { TestFixture } from "tests/core/test-fixture";

describe("unused code entry points", () => {
	const fixture = new TestFixture();

	test("recognizes Node TypeScript shebangs as entry points", () => {
		const project = fixture.project_source.source_scanner_fixture({
			"tools/coding-lint/cli.ts": '#!/usr/bin/env node\nexport { value } from "./dependency";\n',
			"tools/coding-lint/dependency.ts": "export const value = 1;\n",
			"tools/coding-lint/unused.ts": "export const unused = 1;\n",
		});
		const unused_code = new UnusedCode();
		const violations = unused_code.collect_scanner_violations(project.root, project.scanner, project.files);
		expect(violations).toEqual([
			expect.objectContaining({ file: "tools/coding-lint/unused.ts", rule_id: "unused-file" }),
		]);
	});

	test("treats configured test-directory modules as entry points", () => {
		const project = fixture.project_source.source_scanner_fixture({
			"tests/plugin_harness_contract.py":
				"from mcp_proxy.core.plugin.testing.plugin_test_assembly import PluginTestAssembly\n",
			"src/mcp_proxy/core/plugin/testing/plugin_test_assembly.py": "class PluginTestAssembly: pass\n",
		});
		const unused_code = new UnusedCode();
		const violations = unused_code.collect_scanner_violations(project.root, project.scanner, project.files);

		expect({
			entry: project.scanner.entry(resolve(project.root, "tests/plugin_harness_contract.py")),
			unused: violations.map((violation) => violation.file),
		}).toEqual({ entry: true, unused: [] });
	});

	test("recognizes root functions files as entry points", () => {
		const project = fixture.project_source.with_in_memory_project(
			{
				"functions.ts": "export const value = 1;\n",
				"functions.tsx": "export const value = 1;\n",
				"functions.py": "value = 1\n",
			},
			(root, context, files) => ({ root, context, files }),
			new Map(),
		);
		const scanner = new ProjectSourceScanner(project.root, {
			context_state: { available: true, value: project.context },
			entry_files: [],
		});
		const entries = scanner.files().map((file) => scanner.entry(file));
		expect(entries).toEqual([true, true, true]);
	});
});
