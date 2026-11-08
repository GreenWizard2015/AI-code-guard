import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import {
	MODULE_CONSTANT_FILES,
	MODULE_DECLARATION_FILES,
	MODULE_PROTOCOL_FILES,
	MODULE_TYPE_FILES,
} from "src/rules/constants";
import { DirectoryStructureRules } from "src/rules/support/directory_structure_rules";
import { ModuleDeclarationsRule } from "src/rules/support/module_declarations_rule";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

describe("directory structure limits", () => {
	const root = "/virtual/directory-size-project";

	test("reports directories with more than 40 code files", () => {
		const files = Object.fromEntries(
			Array.from({ length: 41 }, (_, index) => [`source/file-${index}.ts`, "export const value = 1;\n"]),
		);
		const paths = Object.keys(files).map((file) => join(root, file));
		const directory_rules = new DirectoryStructureRules(
			{ virtual_project: true, files: paths },
			new InMemoryFileIO(),
			new ModuleDeclarationsRule(
				MODULE_DECLARATION_FILES,
				MODULE_CONSTANT_FILES,
				MODULE_TYPE_FILES,
				MODULE_PROTOCOL_FILES,
			),
		);
		const violations = directory_rules.directory_violation(join(root, "source"), root);

		expect(
			violations.map((violation) => ({
				file: violation.file(),
				message: violation.message(),
				rule_id: violation.rule_id(),
			})),
		).toContainEqual(
			expect.objectContaining({
				message: "directory contains too many files (found 41)",
				rule_id: "directory-max-size",
			}),
		);
	});

	test("does not hide directory size behind empty child directories", () => {
		const files = Object.fromEntries(
			Array.from({ length: 41 }, (_, index) => [`source/file-${index}.ts`, "export const value = 1;\n"]),
		);
		const paths = Object.keys(files).map((file) => join(root, file));
		const directory_rules = new DirectoryStructureRules(
			{ virtual_project: true, files: paths },
			new InMemoryFileIO(),
			new ModuleDeclarationsRule(
				MODULE_DECLARATION_FILES,
				MODULE_CONSTANT_FILES,
				MODULE_TYPE_FILES,
				MODULE_PROTOCOL_FILES,
			),
		);
		const violations = directory_rules.directory_violation(join(root, "source"), root);

		expect(
			violations.map((violation) => ({
				file: violation.file(),
				message: violation.message(),
				rule_id: violation.rule_id(),
			})),
		).toContainEqual(
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
		const directory_rules = new DirectoryStructureRules(
			{ virtual_project: true, files: paths },
			new InMemoryFileIO(),
			new ModuleDeclarationsRule(
				MODULE_DECLARATION_FILES,
				MODULE_CONSTANT_FILES,
				MODULE_TYPE_FILES,
				MODULE_PROTOCOL_FILES,
			),
		);
		const violations = directory_rules.directory_violation(join(root, "functions/worker"), root);

		expect(violations.map((item) => ({ message: item.message(), rule_id: item.rule_id() }))).toEqual([
			{ message: "directory contains too few files (found 2)", rule_id: "directory-min-size" },
		]);
	});
});
