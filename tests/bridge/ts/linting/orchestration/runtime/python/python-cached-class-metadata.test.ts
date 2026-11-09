import { describe, expect, test } from "@jest/globals";
import { LintFileName } from "src/core/context/lint_file_name";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import { PythonAstData } from "src/core/python-ast/python_ast_data";
import { LintStageTimer } from "src/lint_stage_timer";
import { PythonScanner } from "src/linting/orchestration/runtime/python/python_scanner";
import { TestFixture } from "tests/core/test-fixture";

describe("cached Python class metadata", () => {
	test("does not add project metadata to a cached Python AST", () => {
		const test_fixture = new TestFixture();
		const source = ["class Implementation(Base):", "    pass"].join("\n");
		const ast_data = new PythonAstData({
			worker: test_fixture.worker(),
			analysis_identity: new ProjectAnalysisIdentity(test_fixture.file_io()),
			split_batch_enabled: false,
			file_io: test_fixture.file_io(),
			cache_enabled: false,
		});
		const cached_ast = ast_data.source_ast(source);
		const input: Parameters<PythonScanner["lint_python_file"]>[0] = {
			file_name: new LintFileName("implementation.py"),
			source_file: "implementation.py",
			text: source,
			project_class_names: new Set(["Base"]),
			python_class_names: new Set(["Base"]),
			project_protocol_names: new Set(["Base"]),
			project_type_names: new Set<string>(),
			project_alias_names: new Set<string>(),
			normalized_ast: cached_ast,
		};
		const scanner = new PythonScanner("", [], new LintStageTimer());
		scanner.lint_python_file(input, new LintStageTimer());

		expect(cached_ast.source.classes.map(({ structure }) => structure.interfaces)).toEqual([[]]);
	});

	test("does not retain Python project metadata when rescanning a cached AST", () => {
		const test_fixture = new TestFixture();
		const source = ["class Implementation(Base):", "    pass"].join("\n");
		const ast_data = new PythonAstData({
			worker: test_fixture.worker(),
			analysis_identity: new ProjectAnalysisIdentity(test_fixture.file_io()),
			split_batch_enabled: false,
			file_io: test_fixture.file_io(),
			cache_enabled: false,
		});
		const cached_ast = ast_data.source_ast(source);
		const input: Parameters<PythonScanner["lint_python_file"]>[0] = {
			file_name: new LintFileName("implementation.py"),
			source_file: "implementation.py",
			text: source,
			project_class_names: new Set(["Base"]),
			python_class_names: new Set(["Base"]),
			project_protocol_names: new Set(["Base"]),
			project_type_names: new Set<string>(),
			project_alias_names: new Set<string>(),
			normalized_ast: cached_ast,
		};
		const scanner = new PythonScanner("", [], new LintStageTimer());
		scanner.lint_python_file(input, new LintStageTimer());
		const initial_interfaces = cached_ast.source.classes.map(({ structure }) => structure.interfaces);
		const rescanned_input = { ...input, project_protocol_names: new Set<string>() };
		scanner.lint_python_file(rescanned_input, new LintStageTimer());
		const rescanned_interfaces = cached_ast.source.classes.map(({ structure }) => structure.interfaces);

		expect({ initial_interfaces, rescanned_interfaces }).toEqual({
			initial_interfaces: [[]],
			rescanned_interfaces: [[]],
		});
	});
});
