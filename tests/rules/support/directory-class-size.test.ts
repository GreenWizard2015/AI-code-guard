import { describe, expect, test } from "@jest/globals";
import { join } from "node:path";
import { DirectoryStructureRules } from "src/rules/support/directory_structure_rules";
import type { AstClassNodeContract } from "src/types";
import type { ViolationContract } from "src/reporting_protocols";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

describe("directory implementation class limits", () => {
	const root = "/virtual/directory-class-size-project";
	const implementation_class: AstClassNodeContract = {
		name: "ValueStore",
		start: 0,
		end: 1,
		lines: 1,
		sloc: 1,
		interfaces: [],
		base_class_name: "",
		base_class_names: [],
		extends_external_class: false,
		is_data_class: false,
		type_contract: false,
		protocol: false,
		methods: [],
		callback_fields: 0,
		inline_callback_fields: 0,
		fields: [],
		untyped_fields: [],
		dependencies: [],
	};
	const type_contract: AstClassNodeContract = { ...implementation_class, name: "ValueContract", type_contract: true };

	test("reports more than fifteen implementation classes", () => {
		const paths = Array.from({ length: 16 }, (_, index) => join(root, "feature", `item-${index}.ts`));
		const class_counts = new Map(paths.map((file) => [file, [implementation_class]]));
		const rules = new DirectoryStructureRules({ virtual_project: true, files: paths }, new InMemoryFileIO());
		const violations: ViolationContract[] = [];
		rules.append_directory_violations(violations, paths, root, class_counts, new Map());

		expect(violations).toContainEqual(
			expect.objectContaining({
				rule_id: "directory-class-max-size",
				message: "directory contains too many classes (found 16)",
			}),
		);
	});

	test("counts classes from direct files, not their child directories", () => {
		const paths = [
			...Array.from({ length: 2 }, (_, index) => join(root, "feature", `root-${index}.ts`)),
			...Array.from({ length: 3 }, (_, index) => join(root, "feature", "child", `item-${index}.ts`)),
		];
		const class_counts = new Map(paths.map((file) => [file, [implementation_class]]));
		const rules = new DirectoryStructureRules({ virtual_project: true, files: paths }, new InMemoryFileIO());
		const violations: ViolationContract[] = [];
		rules.append_directory_violations(violations, paths, root, class_counts, new Map());

		expect(violations).not.toContainEqual(expect.objectContaining({ rule_id: "directory-class-min-size" }));
	});

	test("does not count interfaces as implementation classes", () => {
		const paths = Array.from({ length: 3 }, (_, index) => join(root, "feature", `item-${index}.ts`));
		const mixed_declarations = [...Array.from({ length: 10 }, () => type_contract), implementation_class];
		const class_counts = new Map(paths.map((file) => [file, mixed_declarations]));
		const rules = new DirectoryStructureRules({ virtual_project: true, files: paths }, new InMemoryFileIO());
		const violations: ViolationContract[] = [];
		rules.append_directory_violations(violations, paths, root, class_counts, new Map());

		expect(violations.filter((violation) => violation.rule_id.startsWith("directory-class-")).length).toBe(0);
	});

	test("does not require placeholder classes when focused child directories own them", () => {
		const paths = [
			join(root, "feature", "index.ts"),
			join(root, "feature", "collector", "collector.ts"),
			join(root, "feature", "collector", "matcher.ts"),
			join(root, "feature", "collector", "mapper.ts"),
		];
		const class_counts = new Map(paths.map((file) => [file, [implementation_class]]));
		const rules = new DirectoryStructureRules({ virtual_project: true, files: paths }, new InMemoryFileIO());
		const violations: ViolationContract[] = [];
		rules.append_directory_violations(violations, paths, root, class_counts, new Map());

		expect(violations.filter((violation) => violation.rule_id === "directory-class-min-size")).toEqual([]);
	});

	test("requires three implementation classes at the project root", () => {
		const file = join(root, "performance_report.py");
		const rules = new DirectoryStructureRules({ virtual_project: true, files: [file] }, new InMemoryFileIO());
		const violations: ViolationContract[] = [];
		rules.append_directory_violations(violations, [file], root, new Map([[file, [implementation_class]]]), new Map());

		expect(violations.filter((violation) => violation.rule_id === "directory-class-min-size")).toHaveLength(1);
	});
});
