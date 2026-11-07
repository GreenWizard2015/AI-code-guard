import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { describe, expect, test } from "@jest/globals";
import { PythonAstBridge } from "src/core/python-ast/python_ast_bridge";

describe("Python bridge coverage", () => {
	test("uses coverage to launch the bridge when coverage is enabled", () => {
		const coverage_key = "COVERAGE_PROCESS_START";
		const previous = process.env[coverage_key];
		process.env[coverage_key] = ".coveragerc";
		const bridge = new PythonAstBridge();
		const arguments_list = bridge.bridge_arguments(true);
		if (previous === undefined) {
			delete process.env[coverage_key];
		} else {
			process.env[coverage_key] = previous;
		}
		expect(arguments_list).toEqual(["-m", "coverage", "run", "--parallel-mode", bridge.bridge_path(), "--batch"]);
	});

	test("launches the bridge directly when coverage is disabled", () => {
		const coverage_key = "COVERAGE_PROCESS_START";
		const previous = process.env[coverage_key];
		delete process.env[coverage_key];
		const bridge = new PythonAstBridge();
		const arguments_list = bridge.bridge_arguments();
		if (previous !== undefined) {
			process.env[coverage_key] = previous;
		}
		expect(arguments_list).toEqual([bridge.bridge_path()]);
	});

	test("keeps batch mode in the direct launch arguments", () => {
		const bridge = new PythonAstBridge();
		const coverage_key = "COVERAGE_PROCESS_START";
		delete process.env[coverage_key];
		expect(bridge.bridge_arguments(true)).toEqual([bridge.bridge_path(), "--batch"]);
	});
});
