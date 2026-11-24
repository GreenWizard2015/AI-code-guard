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

	test("does not infer entry points from filenames", () => {
		const project = fixture._project_source.source_scanner_fixture({
			"tools/coding-lint/cli.ts": 'import { value } from "./dependency";\nvoid value;\n',
			"tools/coding-lint/dependency.ts": "export const value = 1;\n",
			"tools/coding-lint/unused.ts": "export const unused = 1;\n",
			"src/cli.py": "start()\n",
		});
		const entry_point_files = project.scanner.entry_point_files();
		const unused_code = new UnusedCode();
		const unused_violations = unused_code.collect_scanner_violations(project.root, project.scanner, project.files);
		const unused_files = unused_violations
			.filter((violation) => violation.rule_id() === "unused-file")
			.map((violation) => violation.file());
		expect({
			ts_entry: entry_point_files.has(resolve(project.root, "tools/coding-lint/cli.ts")),
			python_entry: entry_point_files.has(resolve(project.root, "src/cli.py")),
			filename_entry_points_are_unused:
				unused_files.includes("tools/coding-lint/cli.ts") && unused_files.includes("src/cli.py"),
		}).toEqual({
			ts_entry: false,
			python_entry: false,
			filename_entry_points_are_unused: true,
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
		const source_entry = project.scanner.project_source_entry();
		const test_module = source_entry.project_path(resolve(project.root, "tests/plugin_harness_contract.py"));
		const test_module_classification = source_entry.classification(test_module);

		expect({
			entry: test_module_classification.entry,
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
		const source_entry = scanner.project_source_entry();
		const entries: boolean[] = [];
		for (const file of scanner.files()) {
			const source_path = source_entry.project_path(file);
			const classification = source_entry.classification(source_path);
			entries.push(classification.entry);
		}
		expect(entries).toEqual([true, true, true]);
	});

	test("keeps URL-loaded Node worker modules reachable", () => {
		const project = fixture._project_source.source_scanner_fixture({
			"tools/coding-lint/cli.ts": '#!/usr/bin/env node\nimport "./worker-pool";\n',
			"tools/coding-lint/worker-pool.ts": [
				'import { Worker } from "node:worker_threads";',
				'const extension = ".ts";',
				"class WorkerPool {",
				"\tprivate worker_entry: URL;",
				"\tpublic constructor() {",
				'\t\tthis.worker_entry = new URL("./worker-entry" + extension, import.meta.url);',
				"\t}",
				"\tpublic launch(): Worker {",
				"\t\treturn new Worker(this.worker_entry);",
				"\t}",
				"}",
				"export {};",
			].join("\n"),
			"tools/coding-lint/worker-entry.ts": "export const worker_ready = true;\n",
			"tools/coding-lint/unused.ts": "export const unused = true;\n",
		});
		const unused_code = new UnusedCode();
		const violations = unused_code.collect_scanner_violations(project.root, project.scanner, project.files);

		expect(violations.map((violation) => violation.file())).toEqual(["tools/coding-lint/unused.ts"]);
	});

	test("keeps all statically selected Node worker entries reachable", () => {
		const project = fixture._project_source.source_scanner_fixture({
			"tools/coding-lint/cli.ts": '#!/usr/bin/env node\nimport "./worker-pool";\n',
			"tools/coding-lint/worker-pool.ts": [
				'import { Worker } from "node:worker_threads";',
				"class WorkerPool {",
				"\tprivate worker_entry: URL;",
				"\tpublic constructor(compiled: boolean) {",
				"\t\tif (compiled) {",
				'\t\t\tthis.worker_entry = new URL("./compiled-worker.ts", import.meta.url);',
				"\t\t} else {",
				'\t\t\tthis.worker_entry = new URL("./source-worker.ts", import.meta.url);',
				"\t\t}",
				"\t}",
				"\tpublic launch(): Worker {",
				"\t\treturn new Worker(this.worker_entry);",
				"\t}",
				"}",
				"export {};",
			].join("\n"),
			"tools/coding-lint/compiled-worker.ts": "export const ready = true;\n",
			"tools/coding-lint/source-worker.ts": "export const ready = true;\n",
			"tools/coding-lint/unused.ts": "export const unused = true;\n",
		});
		const unused_code = new UnusedCode();
		const violations = unused_code.collect_scanner_violations(project.root, project.scanner, project.files);

		expect(violations.map((violation) => violation.file())).toEqual(["tools/coding-lint/unused.ts"]);
	});

	test("keeps statically returned Node worker entries reachable", () => {
		const project = fixture._project_source.source_scanner_fixture({
			"tools/coding-lint/cli.ts": '#!/usr/bin/env node\nimport "./worker-pool";\n',
			"tools/coding-lint/worker-pool.ts": [
				'import { Worker } from "node:worker_threads";',
				"class WorkerPool {",
				"\tprivate selected_worker_entry(compiled: boolean): URL {",
				"\t\tif (compiled) {",
				'\t\t\treturn new URL("./compiled-worker.ts", import.meta.url);',
				"\t\t}",
				'\t\treturn new URL("./source-worker.ts", import.meta.url);',
				"\t}",
				"\tpublic launch(): Worker {",
				"\t\treturn new Worker(this.selected_worker_entry(true));",
				"\t}",
				"}",
				"export {};",
			].join("\n"),
			"tools/coding-lint/compiled-worker.ts": "export const ready = true;\n",
			"tools/coding-lint/source-worker.ts": "export const ready = true;\n",
			"tools/coding-lint/unused.ts": "export const unused = true;\n",
		});
		const unused_code = new UnusedCode();
		const violations = unused_code.collect_scanner_violations(project.root, project.scanner, project.files);

		expect(violations.map((violation) => violation.file())).toEqual(["tools/coding-lint/unused.ts"]);
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
			first_lookup: project.entry.project_path(source_file).relative,
			repeated_lookup: project.entry.project_path(source_file).relative,
			root_lookup: project.entry.project_path(project.root).relative,
			outside_lookup: project.entry.project_path(outside_file).relative,
		}).toEqual({
			first_lookup: "src/main.ts",
			repeated_lookup: "src/main.ts",
			root_lookup: ".",
			outside_lookup: "../outside.ts",
		});
	});
});
