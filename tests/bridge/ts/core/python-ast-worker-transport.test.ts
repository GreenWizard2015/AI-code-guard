import { ChildProcess } from "node:child_process";
import { Socket } from "node:net";
import { describe, expect, test } from "@jest/globals";
import { PythonAstBridge } from "src/core/python_ast_bridge";
import { PythonAstWorker } from "src/core/python-ast-worker.mjs";

describe("Python AST worker transport", () => {
	test("rejects public streams that do not expose native child-process pipes", () => {
		const bridge = new PythonAstBridge();
		const input = new Socket();
		const output = new Socket();
		const child = new ChildProcess();
		Object.defineProperties(child, {
			pid: { value: 417 },
			exitCode: { value: 0 },
			stdin: { value: input },
			stdout: { value: output },
		});
		const worker = new PythonAstWorker(bridge.worker_arguments(), bridge.worker_options(), true, 1000, () => child);
		const error_message = worker.batch_error("public-streams", {});
		input.destroy();
		output.destroy();

		expect({ error: error_message, active: worker.is_active() }).toEqual({
			error: "Error: Python AST worker requires native Node child-process pipes.",
			active: false,
		});
	});

	test("reports a missing child pipe through the worker contract", () => {
		const bridge = new PythonAstBridge();
		const child = new ChildProcess();
		Object.defineProperties(child, { pid: { value: 418 }, exitCode: { value: 0 } });
		const worker = new PythonAstWorker(bridge.worker_arguments(), bridge.worker_options(), true, 1000, () => child);
		const error_message = worker.batch_error("missing-pipes", {});

		expect({ error: error_message, active: worker.is_active() }).toEqual({
			error: "Error: Python AST worker pipes were not created.",
			active: false,
		});
	});
});
