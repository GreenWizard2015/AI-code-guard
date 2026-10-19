import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { DirectoryFacadeRules } from "src/rules/support/directory_facade_rules";
import { DirectoryRules } from "src/rules/support/directory_rules";
import { DirectoryStructureRules } from "src/rules/support/directory_structure_rules";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import type { NormalizedAstFile } from "src/types";
import type { ViolationContract } from "src/protocols";
import { join } from "node:path";

import { describe, expect, test } from "@jest/globals";

describe("directory size lint rules", () => {
	const root = "/virtual/directory-size-project";
	const class_count_files = Object.fromEntries([
		...Array.from({ length: 16 }, (_, index) => [`a/b/c/large-${index}.ts`, "export class Item {}\n"]),
		...Array.from({ length: 5 }, (_, index) => [`a/b/c/d/valid-${index}.ts`, "export class Item {}\n"]),
		...Array.from({ length: 2 }, (_, index) => [`a/b/c/d/e/small-${index}.ts`, "export class Item {}\n"]),
	]);

	test("applies the raw maximum file size to Python test files", () => {
		const source = Array.from({ length: 501 }, (_, index) => `value_${index} = ${index}`).join("\n");
		const violations: ViolationContract[] = [];
		const normalized_ast: NormalizedAstFile = {
			language: "typescript",
			classes: [],
			functions: [],
			parse_issues: [],
			import_issues: [],
			attribute_accesses: [],
			named_symbols: [],
			type_declarations: [],
			reference_aliases: [],
			symbol_references: [],
			literal_references: [],
			literal_constants: [],
			call_references: [],
			type_members: new Map(),
			private_accesses: [],
			repeated_branches: [],
			module_instances: [],
			module_constant_spans: [],
			module_type_spans: [],
			module_protocol_spans: [],
			coding_issues: [],
			python_imports: [],
			python_callable_count: { count: 0, first_line: 0 },
			python_main_guard: false,
			docstring_spans: [],
			responsibility_targets: [],
		};
		const directory_rules = new DirectoryRules(new InMemoryFileIO(), new InMemoryProjectSourceIO(new Map()));
		directory_rules.append_file_violation({
			violations,
			file: "tests/large_test.py",
			text: source,
			classes: [],
			docstring_spans: [],
			normalized_ast,
		});

		expect(violations).toContainEqual(
			expect.objectContaining({
				message: "file is too large (found 501 raw lines)",
				rule_id: "file-max-size",
				priority: 3,
			}),
		);
	});

	test("reports directories with more than 40 code files", () => {
		const files = Object.fromEntries(
			Array.from({ length: 41 }, (_, index) => [`source/file-${index}.ts`, "export const value = 1;\n"]),
		);
		const paths = Object.keys(files).map((file) => join(root, file));
		const directory_rules = new DirectoryStructureRules({ virtual_project: true, files: paths }, new InMemoryFileIO());
		const violations = directory_rules.directory_violation(join(root, "source"), root);
		expect(violations).toContainEqual(
			expect.objectContaining({
				message: "directory contains too many files (found 41)",
				rule_id: "directory-max-size",
			}),
		);
	});

	test("allows ten source subdirectories and reports an eleventh at their parent", () => {
		const source_paths = Array.from({ length: 10 }, (_, index) => join(root, `source/feature-${index}/module.ts`));
		const allowed_rules = new DirectoryStructureRules(
			{ virtual_project: true, files: source_paths },
			new InMemoryFileIO(),
		);
		const allowed_violations: ViolationContract[] = [];
		allowed_rules.append_directory_violations(allowed_violations, source_paths, root, new Map(), new Map());

		const expanded_paths = [...source_paths, join(root, "source/python-feature/module.py")];
		const expanded_rules = new DirectoryStructureRules(
			{ virtual_project: true, files: expanded_paths },
			new InMemoryFileIO(),
		);
		const expanded_violations: ViolationContract[] = [];
		expanded_rules.append_directory_violations(expanded_violations, expanded_paths, root, new Map(), new Map());

		expect({
			allowed: allowed_violations.filter((item) => item.rule_id === "directory-max-source-subdirectories"),
			expanded: expanded_violations.filter((item) => item.rule_id === "directory-max-source-subdirectories"),
		}).toEqual({
			allowed: [],
			expanded: [
				expect.objectContaining({
					file: "source",
					message: "directory contains too many source subdirectories (found 11)",
					rule_id: "directory-max-source-subdirectories",
				}),
			],
		});
	});

	test("counts only subdirectories containing production source files", () => {
		const source_paths = [
			...Array.from({ length: 10 }, (_, index) => join(root, `source/feature-${index}/module.ts`)),
			join(root, "source/tests/test_helper.py"),
		];
		const directory_rules = new DirectoryStructureRules(
			{ virtual_project: true, files: source_paths },
			new InMemoryFileIO(),
		);
		const violations: ViolationContract[] = [];
		directory_rules.append_directory_violations(violations, source_paths, root, new Map(), new Map());

		expect(violations.filter((item) => item.rule_id === "directory-max-source-subdirectories")).toEqual([]);
	});

	test("does not hide directory size behind empty child directories", () => {
		const files = Object.fromEntries(
			Array.from({ length: 41 }, (_, index) => [`source/file-${index}.ts`, "export const value = 1;\n"]),
		);
		const paths = Object.keys(files).map((file) => join(root, file));
		const directory_rules = new DirectoryStructureRules({ virtual_project: true, files: paths }, new InMemoryFileIO());
		const violations = directory_rules.directory_violation(join(root, "source"), root);
		expect(violations).toContainEqual(
			expect.objectContaining({
				message: "directory contains too many files (found 41)",
				rule_id: "directory-max-size",
			}),
		);
	});

	test("does not exempt a nested functions directory from directory size rules", () => {
		const files = {
			"functions/worker/functions.ts": "export const value = 1;\n",
			"functions/worker/helper.ts": "export const value = 1;\n",
		};
		const paths = Object.keys(files).map((file) => join(root, file));
		const directory_rules = new DirectoryStructureRules({ virtual_project: true, files: paths }, new InMemoryFileIO());
		const violations = directory_rules.directory_violation(join(root, "functions/worker"), root);
		expect(violations[0]).toEqual(
			expect.objectContaining({
				message: "directory contains too few files (found 2)",
				rule_id: "directory-min-size",
			}),
		);
	});

	test("reports the maximum class count in a direct source directory", () => {
		const paths = Object.keys(class_count_files).map((file) => join(root, file));
		const directory_rules = new DirectoryStructureRules({ virtual_project: true, files: paths }, new InMemoryFileIO());
		const class_counts = new Map(paths.map((file) => [file, 1]));
		const violations: ReturnType<DirectoryStructureRules["directory_violation"]> = [];
		directory_rules.append_directory_violations(violations, paths, root, class_counts, new Map());
		expect(violations).toContainEqual(
			expect.objectContaining({
				message: "directory contains too many classes (found 16)",
				rule_id: "directory-class-max-size",
			}),
		);
	});

	test("reports the minimum class count only for direct source files", () => {
		const paths = Object.keys(class_count_files).map((file) => join(root, file));
		const directory_rules = new DirectoryStructureRules({ virtual_project: true, files: paths }, new InMemoryFileIO());
		const class_counts = new Map(paths.map((file) => [file, 1]));
		const violations: ReturnType<DirectoryStructureRules["directory_violation"]> = [];
		directory_rules.append_directory_violations(violations, paths, root, class_counts, new Map());
		expect(violations).toContainEqual(
			expect.objectContaining({
				message: "directory contains too few classes (found 2)",
				rule_id: "directory-class-min-size",
			}),
		);
		expect(violations.map((violation) => violation.message)).not.toContain(
			"directory contains too few classes (found 5)",
		);
	});

	test("does not require placeholder classes in a directory with focused child directories", () => {
		const files = {
			"composition/index.ts": "export class RootEntry {}\n",
			"composition/collector/collector.ts": "export class Collector {}\n",
			"composition/collector/matcher.ts": "export class Matcher {}\n",
			"composition/collector/mapper.ts": "export class Mapper {}\n",
		};
		const paths = Object.keys(files).map((file) => join(root, file));
		const virtual_directory_rules = new DirectoryStructureRules(
			{ virtual_project: true, files: paths },
			new InMemoryFileIO(),
		);
		const class_counts = new Map(paths.map((file) => [file, 1]));
		const violations: ReturnType<DirectoryStructureRules["directory_violation"]> = [];
		virtual_directory_rules.append_directory_violations(violations, paths, root, class_counts, new Map());
		expect(violations.filter((violation) => violation.rule_id === "directory-class-min-size")).toEqual([]);
	});

	test("requires the project root to contain three classes", () => {
		const file = join(root, "performance_report.py");
		const directory_rules = new DirectoryStructureRules({ virtual_project: true, files: [file] }, new InMemoryFileIO());
		const violations: ReturnType<DirectoryStructureRules["directory_violation"]> = [];
		directory_rules.append_directory_violations(violations, [file], root, new Map([[file, 1]]), new Map());
		expect(violations.filter((violation) => violation.rule_id === "directory-class-min-size")).toHaveLength(1);
	});

	test("allows only re-exports in facade-only directories", () => {
		const facade_rules = new DirectoryFacadeRules();
		const empty_ast: NormalizedAstFile = {
			language: "typescript",
			classes: [],
			functions: [],
			parse_issues: [],
			import_issues: [],
			attribute_accesses: [],
			named_symbols: [],
			type_declarations: [],
			reference_aliases: [],
			symbol_references: [],
			literal_references: [],
			literal_constants: [],
			call_references: [],
			type_members: new Map(),
			private_accesses: [],
			repeated_branches: [],
			module_instances: [],
			module_constant_spans: [],
			module_type_spans: [],
			module_protocol_spans: [],
			coding_issues: [],
			python_imports: [],
			python_callable_count: { count: 0, first_line: 0 },
			python_main_guard: false,
			docstring_spans: [],
			responsibility_targets: [],
		};
		const declaration_ast = {
			...empty_ast,
			module_constant_spans: [{ start_line: 0, start_column: 0, end_line: 0, end_column: 1 }],
		};
		const violations = facade_rules.facade_violations(
			"/project",
			["/project/facade/index.ts", "/project/bad/index.ts"],
			new Map([
				["/project/facade/index.ts", empty_ast],
				["/project/bad/index.ts", declaration_ast],
			]),
		);
		expect(violations.filter((item) => item.rule_id === "facade-file-content")).toHaveLength(1);
	});
});
