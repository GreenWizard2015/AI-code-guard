import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { join } from "node:path";
import { AstModel } from "src/core/ast_model";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { LintStageTimer } from "src/lint_stage_timer";
import type { ViolationContract } from "src/reporting_protocols";
import {
	MODULE_CONSTANT_FILES,
	MODULE_DECLARATION_FILES,
	MODULE_PROTOCOL_FILES,
	MODULE_TYPE_FILES,
} from "src/rules/constants";
import { DirectoryFacadeRules } from "src/rules/support/directory_facade_rules";
import { DirectoryRules } from "src/rules/support/directory_rules";
import { DirectoryStructureRules } from "src/rules/support/directory_structure_rules";
import { ModuleDeclarationsRule } from "src/rules/support/module_declarations_rule";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

import { describe, expect, test } from "@jest/globals";

describe("directory size lint rules", () => {
	const root = "/virtual/directory-size-project";

	test.each([
		"tests/large_test.py",
		"src/__init__.py",
		"src/constants.ts",
		"src/constants.py",
		"src/types.ts",
		"src/types.py",
		"src/types.d.ts",
		"src/protocols.ts",
		"src/protocols.py",
		"src/cli.ts",
	])("applies the raw maximum file size to %s", (file) => {
		const violations: ViolationContract[] = [];
		const ast_model = new AstModel("typescript");
		const normalized_ast = ast_model.empty_ast_file();
		const directory_rules = new DirectoryRules(new InMemoryFileIO(), new InMemoryProjectSourceIO(new Map()));
		const source_line = file.endsWith(".py") ? "value = 1" : "export const value = 1;";
		const source = Array.from({ length: 501 }, () => source_line).join("\n");
		directory_rules.append_file_violation(
			{
				violations,
				file,
				text: source,
				classes: [],
				docstring_spans: [],
				normalized_ast,
			},
			new LintStageTimer(),
		);

		expect(violations).toHaveLength(1);
		expect(
			violations.map((violation) => ({
				file: violation.file(),
				message: violation.message(),
				rule_id: violation.rule_id(),
				priority: violation.priority(),
			})),
		).toEqual([
			expect.objectContaining({
				file,
				message: "file is too large (found 501 raw lines)",
				rule_id: "file-max-size",
				priority: 3,
			}),
		]);
	});

	test("applies the same minimum size to declaration files and test files", () => {
		const violations: ViolationContract[] = [];
		const ast_model = new AstModel("typescript");
		const normalized_ast = ast_model.empty_ast_file();
		const directory_rules = new DirectoryRules(new InMemoryFileIO(), new InMemoryProjectSourceIO(new Map()));
		for (const file of [
			"tests/small.test.ts",
			"src/__init__.py",
			"src/constants.ts",
			"src/constants.py",
			"src/types.ts",
			"src/types.py",
			"src/types.d.ts",
			"src/protocols.ts",
			"src/protocols.py",
			"src/cli.ts",
		]) {
			directory_rules.append_file_violation(
				{
					violations,
					file,
					text: file.endsWith(".py") ? "value = 1" : "export const value = 1;",
					classes: [],
					docstring_spans: [],
					normalized_ast,
				},
				new LintStageTimer(),
			);
		}

		expect(violations.filter((item) => item.rule_id() === "file-min-size").map((item) => item.file())).toEqual([
			"tests/small.test.ts",
			"src/__init__.py",
			"src/constants.ts",
			"src/constants.py",
			"src/types.ts",
			"src/types.py",
			"src/types.d.ts",
			"src/protocols.ts",
			"src/protocols.py",
			"src/cli.ts",
		]);
	});

	test("allows ten source subdirectories and reports an eleventh at their parent", () => {
		const source_paths = Array.from({ length: 10 }, (_, index) => join(root, `source/feature-${index}/module.ts`));
		const allowed_rules = new DirectoryStructureRules(
			{ virtual_project: true, files: source_paths },
			new InMemoryFileIO(),
			new ModuleDeclarationsRule(
				MODULE_DECLARATION_FILES,
				MODULE_CONSTANT_FILES,
				MODULE_TYPE_FILES,
				MODULE_PROTOCOL_FILES,
			),
		);
		const allowed_violations: ViolationContract[] = [];
		allowed_rules.append_directory_violations(allowed_violations, source_paths, root, new Map(), new Map());

		const expanded_paths = [...source_paths, join(root, "source/python-feature/module.py")];
		const expanded_rules = new DirectoryStructureRules(
			{ virtual_project: true, files: expanded_paths },
			new InMemoryFileIO(),
			new ModuleDeclarationsRule(
				MODULE_DECLARATION_FILES,
				MODULE_CONSTANT_FILES,
				MODULE_TYPE_FILES,
				MODULE_PROTOCOL_FILES,
			),
		);
		const expanded_violations: ViolationContract[] = [];
		expanded_rules.append_directory_violations(expanded_violations, expanded_paths, root, new Map(), new Map());

		expect({
			allowed: allowed_violations
				.filter((item) => item.rule_id() === "directory-max-source-subdirectories")
				.map((item) => ({ file: item.file(), message: item.message(), rule_id: item.rule_id() })),
			expanded: expanded_violations
				.filter((item) => item.rule_id() === "directory-max-source-subdirectories")
				.map((item) => ({ file: item.file(), message: item.message(), rule_id: item.rule_id() })),
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
			new ModuleDeclarationsRule(
				MODULE_DECLARATION_FILES,
				MODULE_CONSTANT_FILES,
				MODULE_TYPE_FILES,
				MODULE_PROTOCOL_FILES,
			),
		);
		const violations: ViolationContract[] = [];
		directory_rules.append_directory_violations(violations, source_paths, root, new Map(), new Map());

		expect(violations.filter((item) => item.rule_id() === "directory-max-source-subdirectories")).toEqual([]);
	});

	test("allows only re-exports in facade-only directories", () => {
		const facade_rules = new DirectoryFacadeRules();
		const ast_model = new AstModel("typescript");
		const empty_ast = ast_model.empty_ast_file();
		const declaration_ast = {
			...empty_ast,
			module_declarations: {
				...empty_ast.module_declarations,
				module_constant_spans: [{ start_line: 0, start_column: 0, end_line: 0, end_column: 1 }],
			},
		};
		const violations = facade_rules.facade_violations(
			"/project",
			["/project/facade/index.ts", "/project/bad/index.ts"],
			new Map([
				["/project/facade/index.ts", empty_ast],
				["/project/bad/index.ts", declaration_ast],
			]),
		);
		expect(violations.filter((item) => item.rule_id() === "facade-file-content")).toHaveLength(1);
	});
});
