import { ChildProcess } from "node:child_process";
import { PythonAstBridge } from "src/core/python_ast_bridge";
import { PythonAstWorker } from "src/core/python-ast-worker.mjs";

describe("Python AST worker", () => {
	test("handles an asynchronous spawn error and settles worker exit", async () => {
		const bridge = new PythonAstBridge();
		const child = new ChildProcess();
		const worker = new PythonAstWorker(bridge.worker_arguments(), bridge.worker_options(), true, 20, () => {
			queueMicrotask(() => child.emit("error", new Error("spawn ENOENT")));
			return child;
		});
		const error_message = worker.batch_error("spawn-error", {});
		await worker.wait_for_exit();

		expect({ error_message, active: worker.is_active(), process_exited: worker.process_exited() }).toEqual({
			error_message: "Error: Python AST worker process did not start.",
			active: false,
			process_exited: true,
		});
	});

	test("reuses one worker for named batches until explicit exit", () => {
		const bridge = new PythonAstBridge();
		const worker = new PythonAstWorker(bridge.worker_arguments(), bridge.worker_options(), true);
		const first = worker.batch_result("batch-1", { first: "class First:\n    pass\n" });
		const second = worker.batch_result("batch-2", { second: "def second():\n    pass\n" });
		worker.close();

		expect({
			first_batch: first.batchId,
			first_files: [...first.asts.keys()],
			second_batch: second.batchId,
			second_files: [...second.asts.keys()],
		}).toEqual({
			first_batch: "batch-1",
			first_files: ["first"],
			second_batch: "batch-2",
			second_files: ["second"],
		});
	});

	test("returns AST values under the submitted source names", () => {
		const bridge = new PythonAstBridge();
		const worker = new PythonAstWorker(bridge.worker_arguments(), bridge.worker_options(), true);
		const result = worker.batch_result("named-batch", {
			"first.py": "class First:\n    pass\n",
			"second.py": "def second():\n    pass\n",
		});
		worker.close();

		expect([...result.asts.keys()]).toEqual(["first.py", "second.py"]);
	});

	test("reads responses larger than one worker chunk", () => {
		const bridge = new PythonAstBridge();
		const worker = new PythonAstWorker(bridge.worker_arguments(), bridge.worker_options(), true);
		const source = "class Large:\n" + "    value = 1\n".repeat(256);
		const result = worker.batch_result("large-batch", { "large.py": source });
		worker.close();

		expect({
			files: [...result.asts.keys()],
			response_bytes: Buffer.byteLength(JSON.stringify(Object.fromEntries(result.asts))) > 64 * 1024,
		}).toEqual({ files: ["large.py"], response_bytes: true });
	});

	test("returns despite warning output larger than the stderr pipe", () => {
		const bridge = new PythonAstBridge();
		const worker_options = bridge.worker_options();
		const worker = new PythonAstWorker(
			bridge.worker_arguments(),
			{
				...worker_options,
				env: { ...worker_options.env, PYTHONWARNINGS: "always" },
			},
			true,
		);
		const source = "value = " + "'\\q' ".repeat(5000) + "\n";
		let ast_names: string[] = [];
		try {
			const result = worker.batch_result("warnings", { "warnings.py": source });
			ast_names = [...result.asts.keys()];
		} finally {
			worker.close();
		}
		expect(ast_names).toEqual(["warnings.py"]);
	});

	test("keeps valid unicode Python expressions in the batch", () => {
		const bridge = new PythonAstBridge();
		const worker = new PythonAstWorker(bridge.worker_arguments(), bridge.worker_options(), true);
		const result = worker.batch_result("unicode-batch", {
			"unicode.py": "éééééééééé = first + second / third\n",
		});
		worker.close();

		expect([...result.asts.keys()]).toEqual(["unicode.py"]);
	});

	test("bounds a stalled batch and terminates the worker process", async () => {
		const bridge = new PythonAstBridge();
		const worker = new PythonAstWorker(["-c", "while True: pass"], bridge.worker_options(), true, 20);
		worker.start_persistent();
		const error_message = worker.batch_error("stalled-batch", { "stalled.py": "value = 1\n" });
		await worker.wait_for_exit();
		expect({ error_message, worker_is_inactive: !worker.is_active(), process_exited: worker.process_exited() }).toEqual(
			{
				error_message: expect.stringContaining("Python AST worker response timed out."),
				worker_is_inactive: true,
				process_exited: true,
			},
		);
	});

	test("bounds stalled worker shutdown and still cleans resources", () => {
		const bridge = new PythonAstBridge();
		const worker = new PythonAstWorker(["-c", "while True: pass"], bridge.worker_options(), true, 20);
		worker.start_persistent();

		expect(() => worker.close()).toThrow("Python AST worker response timed out.");
		expect(worker.is_active()).toBe(false);
	});

	test("preserves Python worker stderr in a failed batch", () => {
		const bridge = new PythonAstBridge();
		const diagnostic = "sentinel Python parser failure";
		const script = `import sys\nsys.stderr.write(${JSON.stringify(diagnostic)})\nsys.stderr.flush()\n`;
		const worker = new PythonAstWorker(["-c", script], bridge.worker_options(), true, 1000);
		const error_message = worker.batch_error("stderr-failure", { "failure.py": "value = 1\n" });

		expect(error_message).toEqual(expect.stringContaining(diagnostic));
	});

	test("preserves one-shot bridge stderr and exit details", () => {
		const bridge = new PythonAstBridge();
		const diagnostic = "one-shot parser failure";
		const script = `import sys\nsys.stderr.write(${JSON.stringify(diagnostic)})\nsys.exit(7)\n`;
		const worker = new PythonAstWorker(["-c", script], bridge.worker_options(), false, 1000);
		const error_message = worker.batch_error("one-shot-stderr", { "failure.py": "value = 1\n" });

		expect(error_message).toEqual(expect.stringContaining(`exit status 7; stderr: ${diagnostic}`));
	});

	test("bounds a stalled one-shot bridge process", () => {
		const bridge = new PythonAstBridge();
		const worker = new PythonAstWorker(["-c", "while True: pass"], bridge.worker_options(), false, 20);
		const error_message = worker.batch_error("one-shot-timeout", { "stalled.py": "value = 1\n" });

		expect(error_message.includes("ETIMEDOUT") || error_message.includes("timed out")).toBe(true);
	});
});
