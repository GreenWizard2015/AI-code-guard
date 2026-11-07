import { resolve } from "node:path";
import { ProjectSourceScanner } from "src/core/project-source/project_source_scanner";
import { UnusedCode } from "src/core/project-source/unused_code";
import { TestFixture } from "tests/core/test-fixture";

import { describe, expect, test } from "@jest/globals";

describe("unused code checker", () => {
	const fixture = new TestFixture();

	test("reports unreachable TypeScript files and follows relative imports", () => {
		const project = fixture._project_source.source_scanner_fixture(
			{
				"tools/coding-lint/index.ts": "export { value } from './reachable';\n",
				"tools/coding-lint/reachable.ts": "export const value = 1;\n",
				"tools/coding-lint/unused.ts": "export const unused = 1;\n",
			},
			["tools/coding-lint/index.ts"],
		);
		const unused_code = new UnusedCode();
		const violations = unused_code.collect_scanner_violations(project.root, project.scanner, project.files);
		expect(violations.map((violation) => violation.file())).toEqual(["tools/coding-lint/unused.ts"]);
	});

	test("does not report an imported module as unused", () => {
		const project = fixture._project_source.source_scanner_fixture(
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
		const project = fixture._project_source.source_scanner_fixture(
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
		const project = fixture._project_source.source_scanner_fixture(
			{
				"main.ts": "export const main = true;\n",
				"a.ts": 'import "./b";\nexport const a = true;\n',
				"b.ts": 'import "./a";\nexport const b = true;\n',
			},
			["main.ts"],
		);
		const unused_code = new UnusedCode();
		const violations = unused_code.collect_scanner_violations(project.root, project.scanner, project.files);

		expect(violations.map((violation) => violation.file()).sort()).toEqual(["a.ts", "b.ts"]);
	});

	test("keeps an import cycle reachable from an entry point", () => {
		const project = fixture._project_source.source_scanner_fixture(
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

	test("finishes traversal of reachable and disconnected multi-file import cycles", () => {
		const project = fixture._project_source.source_scanner_fixture(
			{
				"main.ts": 'import "./a";\n',
				"a.ts": 'import "./b";\nexport const a = true;\n',
				"b.ts": 'import "./c";\nexport const b = true;\n',
				"c.ts": 'import "./a";\nexport const c = true;\n',
				"orphan-a.ts": 'import "./orphan-b";\nexport const orphan_a = true;\n',
				"orphan-b.ts": 'import "./orphan-a";\nexport const orphan_b = true;\n',
			},
			["main.ts"],
		);
		const unused_code = new UnusedCode();
		const violations = unused_code.collect_scanner_violations(project.root, project.scanner, project.files);

		expect(violations.map((violation) => violation.file()).sort()).toEqual(["orphan-a.ts", "orphan-b.ts"]);
	});

	test("reports missing configured TypeScript path aliases", () => {
		const project = fixture._project_source.with_in_memory_project(
			{
				"tsconfig.json": JSON.stringify({
					compilerOptions: { baseUrl: ".", paths: { "@domain/*": ["src/domain/*"] } },
				}),
				"main.ts": 'import { Item } from "@domain/item";\nexport const item: Item | null = null;\n',
			},
			({ root, context, files }) => ({
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
		const unresolved = project.scanner.imports(importer, new Set(project.files)).unresolved_specifiers();

		expect(unresolved).toContain("@domain/item");
	});

	test("distinguishes a plain package import from a same-named from-import", () => {
		const project = fixture._project_source.source_scanner_fixture(
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
		const plain_import = [...project.scanner.imports(plain_importer, available).resolved_targets()];
		const named_import = [...project.scanner.imports(named_importer, available).resolved_targets()];
		const unused_code = new UnusedCode();
		const violations = unused_code.collect_scanner_violations(project.root, project.scanner, project.files);

		expect({ plain_import, named_import, violations }).toEqual({
			plain_import: [package_initializer],
			named_import: [child_module],
			violations: [],
		});
	});
});
