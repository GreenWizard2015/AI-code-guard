import "src/rules/support/non_english_source_text_rules";
import "src/rules/support/directory_rules";
import { DirectoryRules } from "src/rules/support/directory_rules";
import type { DirectoryFileSet } from "src/project_analysis_types";
import type { ViolationContract } from "src/reporting_protocols";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { DirectoryFileCatalog } from "src/rules/support/directory_file_catalog";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { join } from "node:path";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";

describe("coding-lint directory rules", () => {
	const root = "/virtual/directory-project";

	test("allows empty directories and ignores __init__.py", () => {
		const directory_rules = new DirectoryRules(new InMemoryFileIO(), new InMemoryProjectSourceIO(new Map()));
		const init_file = join(root, "pkg/__init__.py");
		const empty_files: DirectoryFileSet = { virtual_project: true, files: [] };
		const init_files: DirectoryFileSet = { virtual_project: true, files: [init_file] };
		const violations = {
			empty: directory_rules.collect_directory_violations([], root, new Map(), new Map(), empty_files),
			init: directory_rules.collect_directory_violations([init_file], root, new Map(), new Map(), init_files),
		};
		expect(violations.empty).toEqual([]);
		expect(violations.init).toEqual([]);
	});

	test("recognizes nested virtual directories whose names begin with two dots", () => {
		const nested_file = join(root, "..generated/child.ts");
		const catalog = new DirectoryFileCatalog({ virtual_project: true, files: [nested_file] }, new InMemoryFileIO());

		expect(catalog.child_directory_files(root)).toBe(true);
	});

	test("requires 3 to 40 files in a non-empty leaf directory", () => {
		const directory_rules = new DirectoryRules(new InMemoryFileIO(), new InMemoryProjectSourceIO(new Map()));
		const counts = [2, 3, 40, 41];
		const violations = counts.map((count) => {
			const directory = join(root, `pkg-${count}`);
			const paths = Array.from({ length: count }, (_, index) => join(directory, `${index}.ts`));
			const directory_files: DirectoryFileSet = { virtual_project: true, files: paths };
			return directory_rules.collect_directory_violations(paths, root, new Map(), new Map(), directory_files);
		});
		expect({
			minimum: violations[0]?.[0]?.rule_id === "directory-min-size",
			three: violations[1],
			forty: violations[2],
			maximum: violations[3]?.[0]?.rule_id === "directory-max-size",
		}).toEqual({ minimum: true, three: [], forty: [], maximum: true });
	});

	test("does not apply production directory-size limits to test folders", () => {
		const directory_rules = new DirectoryRules(new InMemoryFileIO(), new InMemoryProjectSourceIO(new Map()));
		const file = join(root, "tests/one.test.ts");
		const files: DirectoryFileSet = { virtual_project: true, files: [file] };
		const violations = directory_rules.collect_directory_violations([file], root, new Map(), new Map(), files);

		expect(violations).toEqual([]);
	});

	test("applies the file-size limit to a class-named module", () => {
		const file = join(root, "path_python_bridge_file_io.ts");
		const text = "export class PathPythonBridgeFileIO { public file_present(): boolean { return true; } }\n";
		const ast_file = new TypeScriptAstFile(file, text);
		const normalized_ast = ast_file.normalized();
		const violations: ViolationContract[] = [];

		const file_rules = new DirectoryRules(new InMemoryFileIO(), new InMemoryProjectSourceIO(new Map()));
		file_rules.append_file_violation({
			violations,
			file,
			text,
			classes: normalized_ast.classes,
			docstring_spans: normalized_ast.docstring_spans,
			normalized_ast,
		});

		expect(violations.map((item) => item.rule_id)).toContain("file-min-size");
	});
});
