import { UnusedCode } from "src/core/unused_code";
import { ProjectSourceScanner } from "src/core/project-source/project_source_scanner";
import { resolve } from "node:path";
import { TestFixture } from "tests/core/test-fixture";

import { describe, expect, test } from "@jest/globals";

describe("unused code checker", () => {
	const fixture = new TestFixture();

	test("reports unreachable TypeScript files and follows relative imports", () => {
		const project = fixture.source_scanner_fixture(
			{
				"tools/coding-lint/index.ts": "export { value } from './reachable';\n",
				"tools/coding-lint/reachable.ts": "export const value = 1;\n",
				"tools/coding-lint/unused.ts": "export const unused = 1;\n",
			},
			["tools/coding-lint/index.ts"],
		);
		const unused_code = new UnusedCode();
		const violations = unused_code.collect_scanner_violations(project.root, project.scanner, project.files);
		expect(violations.map((violation) => violation.file)).toEqual(["tools/coding-lint/unused.ts"]);
	});

	test("does not report an imported module as unused", () => {
		const project = fixture.source_scanner_fixture(
			{
				"tools/coding-lint/index.ts": "import dependency = require('./dependency');\ndependency.value;\n",
				"tools/coding-lint/dependency.ts": "export const value = 1;\n",
			},
			["tools/coding-lint/index.ts"],
		);
		const unused_code = new UnusedCode();
		const violations = unused_code.collect_scanner_violations(project.root, project.scanner, project.files);
		expect(violations).toEqual([]);
	});

	test("does not traverse imported runtime modules outside the source inventory", () => {
		const project = fixture.source_scanner_fixture(
			{
				"tools/coding-lint/index.ts": 'import { Worker } from "./worker.mjs";\nvoid Worker;\n',
				"tools/coding-lint/worker.mjs": "export class Worker {}\n",
			},
			["tools/coding-lint/index.ts"],
		);
		const unused_code = new UnusedCode();
		const violations = unused_code.collect_scanner_violations(project.root, project.scanner, project.files);

		expect(violations).toEqual([]);
	});

	test("reports files in a disconnected import cycle as unused", () => {
		const project = fixture.source_scanner_fixture(
			{
				"main.ts": "export const main = true;\n",
				"a.ts": 'import "./b";\nexport const a = true;\n',
				"b.ts": 'import "./a";\nexport const b = true;\n',
			},
			["main.ts"],
		);
		const unused_code = new UnusedCode();
		const violations = unused_code.collect_scanner_violations(project.root, project.scanner, project.files);

		expect(violations.map((violation) => violation.file).sort()).toEqual(["a.ts", "b.ts"]);
	});

	test("keeps an import cycle reachable from an entry point", () => {
		const project = fixture.source_scanner_fixture(
			{
				"main.ts": 'import "./a";\n',
				"a.ts": 'import "./b";\nexport const a = true;\n',
				"b.ts": 'import "./a";\nexport const b = true;\n',
			},
			["main.ts"],
		);
		const unused_code = new UnusedCode();
		const violations = unused_code.collect_scanner_violations(project.root, project.scanner, project.files);

		expect(violations).toEqual([]);
	});

	test("reports missing configured TypeScript path aliases", () => {
		const project = fixture.with_in_memory_project(
			{
				"tsconfig.json": JSON.stringify({
					compilerOptions: { baseUrl: ".", paths: { "@domain/*": ["src/domain/*"] } },
				}),
				"main.ts": 'import { Item } from "@domain/item";\nexport const item: Item | null = null;\n',
			},
			(root, context, files) => ({
				root,
				scanner: new ProjectSourceScanner(root, {
					context_state: { available: true, value: context },
					entry_files: [],
				}),
				files: [...files],
			}),
			new Map(),
		);
		const importer = resolve(project.root, "main.ts");
		const unresolved = project.scanner.unresolved_relative_imports(importer, new Set(project.files));

		expect(unresolved).toContain("@domain/item");
	});

	test("distinguishes a plain package import from a same-named from-import", () => {
		const project = fixture.source_scanner_fixture(
			{
				"plain.py": "import pkg\n",
				"named.py": "from pkg import pkg\n",
				"pkg/__init__.py": "value = 1\n",
				"pkg/pkg.py": "value = 1\n",
			},
			["plain.py", "named.py"],
		);
		const plain_importer = resolve(project.root, "plain.py");
		const named_importer = resolve(project.root, "named.py");
		const package_initializer = resolve(project.root, "pkg/__init__.py");
		const child_module = resolve(project.root, "pkg/pkg.py");
		const available = new Set(project.files);
		const plain_import = [...project.scanner.resolved_imports(plain_importer, available)];
		const named_import = [...project.scanner.resolved_imports(named_importer, available)];
		const unused_code = new UnusedCode();
		const violations = unused_code.collect_scanner_violations(project.root, project.scanner, project.files);

		expect({ plain_import, named_import, violations }).toEqual({
			plain_import: [package_initializer],
			named_import: [child_module],
			violations: [],
		});
	});

	test("counts a top-level literal dynamic import as a file reference", () => {
		const project = fixture.source_scanner_fixture(
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
		const project = fixture.source_scanner_fixture(
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
		const project = fixture.with_in_memory_project(
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
		const project = fixture.with_in_memory_project(
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

	test("recognizes Node TypeScript shebangs as entry points", () => {
		const project = fixture.source_scanner_fixture({
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

	test("recognizes root functions files as entry points", () => {
		const project = fixture.with_in_memory_project(
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
