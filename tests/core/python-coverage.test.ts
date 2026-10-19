import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { describe, expect, test } from "@jest/globals";
import { PythonAstBridge } from "src/core/python_ast_bridge";

describe("Python bridge coverage", () => {
	test("uses coverage to launch the bridge when coverage is enabled", () => {
		const previous = process.env.COVERAGE_PROCESS_START;
		process.env.COVERAGE_PROCESS_START = ".coveragerc";
		const bridge = new PythonAstBridge();
		const arguments_list = bridge.bridge_arguments(true);
		if (previous === undefined) {
			delete process.env.COVERAGE_PROCESS_START;
		} else {
			process.env.COVERAGE_PROCESS_START = previous;
		}
		expect(arguments_list).toEqual(["-m", "coverage", "run", "--parallel-mode", bridge.bridge_path(), "--batch"]);
	});

	test("launches the bridge directly when coverage is disabled", () => {
		const previous = process.env.COVERAGE_PROCESS_START;
		delete process.env.COVERAGE_PROCESS_START;
		const bridge = new PythonAstBridge();
		const arguments_list = bridge.bridge_arguments();
		if (previous !== undefined) {
			process.env.COVERAGE_PROCESS_START = previous;
		}
		expect(arguments_list).toEqual([bridge.bridge_path()]);
	});

	test("keeps batch mode in the direct launch arguments", () => {
		const bridge = new PythonAstBridge();
		delete process.env.COVERAGE_PROCESS_START;
		expect(bridge.bridge_arguments(true)).toEqual([bridge.bridge_path(), "--batch"]);
	});
});
