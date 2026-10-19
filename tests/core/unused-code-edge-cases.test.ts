import { describe, expect, test } from "@jest/globals";
import { UnusedCode } from "src/core/unused_code";
import { ProjectSourceScanner } from "src/core/project-source/project_source_scanner";
import { TestFixture } from "tests/core/test-fixture";

describe("unused code edge cases", () => {
	const fixture = new TestFixture();
	/** Responsibilities: _virtual source scanner preparation_. **/
	const project_scanner = (
		files: Record<string, string>,
		entry_files: readonly string[] = [],
	): { root: string; scanner: ProjectSourceScanner; files: string[] } => {
		return fixture.with_in_memory_project(
			files,
			(root, context) => {
				const scanner = new ProjectSourceScanner(root, {
					context_state: { available: true, value: context },
					entry_files,
				});
				return { root, scanner, files: scanner.files() };
			},
			new Map(),
		);
	};

	test("reports an unreachable importer and its dependency as unused", () => {
		const project = project_scanner(
			{
				"tools/coding-lint/index.ts": "export const entry = 1;\n",
				"tools/coding-lint/importer.ts": "export { value } from './dependency';\n",
				"tools/coding-lint/dependency.ts": "export const value = 1;\n",
			},
			["tools/coding-lint/index.ts"],
		);
		const unused_code = new UnusedCode();
		const violations = unused_code.collect_scanner_violations(project.root, project.scanner, project.files);
		expect(violations.map((violation) => violation.file)).toEqual([
			"tools/coding-lint/importer.ts",
			"tools/coding-lint/dependency.ts",
		]);
	});

	test("reports unresolved relative imports", () => {
		const project = project_scanner({ "tools/coding-lint/index.ts": "import './deleted-module';\n" }, [
			"tools/coding-lint/index.ts",
		]);
		const unused_code = new UnusedCode();
		const violations = unused_code.collect_scanner_violations(project.root, project.scanner, project.files);
		expect(violations).toEqual([
			expect.objectContaining({
				file: "tools/coding-lint/index.ts",
				rule_id: "missing-import",
				message: "Relative import cannot be resolved: ./deleted-module",
			}),
		]);
	});
});
