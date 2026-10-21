import { describe, expect, test } from "@jest/globals";
import { resolve } from "node:path";
import { ProjectSourceScanner } from "src/core/project-source/project_source_scanner";
import { UnusedCode } from "src/core/project-source/unused_code";
import { TestFixture } from "tests/core/test-fixture";

describe("unused code import resolution", () => {
	const fixture = new TestFixture();

	test("counts a top-level literal dynamic import as a file reference", () => {
		const project = fixture.project_source.source_scanner_fixture(
			{
				"main.ts": 'export const worker = import("./worker");\n',
				"worker.ts": "export const value = 1;\n",
			},
			["main.ts"],
		);
		const unused_code = new UnusedCode();
		const violations = unused_code.collect_scanner_violations(project.root, project.scanner, project.files);

		expect(violations).toEqual([]);
	});

	test("counts a function-local literal dynamic import as a file reference", () => {
		const project = fixture.project_source.source_scanner_fixture(
			{
				"main.ts": 'export async function load() { return import("./worker"); }\n',
				"worker.ts": "export const value = 1;\n",
			},
			["main.ts"],
		);
		const unused_code = new UnusedCode();
		const violations = unused_code.collect_scanner_violations(project.root, project.scanner, project.files);

		expect(violations).toEqual([]);
	});

	test("resolves TypeScript imports from the prepared context snapshot", () => {
		const project = fixture.project_source.with_in_memory_project(
			{
				"main.ts": 'import { value } from "./value";\nexport const result = value;\n',
				"value.ts": "export const value = 1;\n",
			},
			(root, context, files) => ({ root, context, files }),
			new Map(),
		);
		const scanner = new ProjectSourceScanner(project.root, {
			context_state: { available: true, value: project.context },
			entry_files: [],
		});
		const main = resolve(project.root, "main.ts");
		const value = resolve(project.root, "value.ts");
		const result = [...scanner.resolved_imports(main, new Set([main, value]))];

		expect(result).toEqual([expect.stringMatching(/\/value\.ts$/u)]);
	});

	test("tries later snapshot candidates when an earlier disk candidate is excluded", () => {
		const project = fixture.project_source.with_in_memory_project(
			{
				"main.ts": 'import { value } from "./value";\nexport const result = value;\n',
				"value.tsx": "export const value = 1;\n",
			},
			(root, context, files) => ({ root, context, files }),
			new Map(),
		);
		const scanner = new ProjectSourceScanner(project.root, {
			context_state: { available: true, value: project.context },
			entry_files: [],
		});
		const main = resolve(project.root, "main.ts");
		const value = resolve(project.root, "value.tsx");
		const result = [...scanner.resolved_imports(main, new Set([main, value]))];

		expect(result).toEqual([expect.stringMatching(/\/value\.tsx$/u)]);
	});
});
