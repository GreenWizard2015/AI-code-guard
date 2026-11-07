import { PYTHON_AST_WORKER_IO_TIMEOUT_MS } from "src/core/python-ast/constants";
import { PythonAstBridge } from "src/core/python-ast/python_ast_bridge";
import { PythonAstWorker } from "src/core/python-ast/python_ast_worker.mjs";

describe("Python AST worker transport", () => {
	test("returns despite warning output larger than the stderr pipe", () => {
		const bridge = new PythonAstBridge();
		const worker_options = bridge.worker_options();
		const worker = new PythonAstWorker({
			arguments_list: bridge.worker_arguments(),
			options: {
				...worker_options,
				env: { ...worker_options.env, PYTHONWARNINGS: "always" },
			},
			persistent: true,
			io_timeout_ms: PYTHON_AST_WORKER_IO_TIMEOUT_MS,
		});
		const source = `value = ${"'\\q' ".repeat(5000)}\n`;
		let ast_names: string[] = [];
		try {
			const sources = new Map(Object.entries({ "warnings.py": source }));
			const result = worker.batch_result("warnings", sources);
			ast_names = [...result.asts.keys()];
		} finally {
			worker.close();
		}
		expect(ast_names).toEqual(["warnings.py"]);
	});

	test("drains a large response before writing the next large batch and routes both batch ids", () => {
		const bridge = new PythonAstBridge();
		const io_timeout_ms = 4_000;
		const worker = new PythonAstWorker({
			arguments_list: bridge.worker_arguments(),
			options: bridge.worker_options(),
			persistent: true,
			io_timeout_ms,
		});
		const payload_size = 2 * 1024 * 1024;
		const large_response_source = `payload = "${"x".repeat(payload_size)}"\n`;
		const large_request_source = `# ${"r".repeat(payload_size)}\nrequest_value = 2\n`;
		let observed: {
			first_batch_id: string;
			first_ast_size: number;
			second_batch_id: string;
			second_ast_names: string[];
		} = {
			first_batch_id: "",
			first_ast_size: 0,
			second_batch_id: "",
			second_ast_names: [],
		};
		try {
			worker.start_batch("large-response-batch", new Map([["large-response.py", large_response_source]]));
			worker.start_batch("large-request-batch", new Map([["large-request.py", large_request_source]]));

			const second = worker.complete_batch("large-request-batch");
			const first = worker.complete_batch("large-response-batch");
			const first_ast_text = JSON.stringify(first.asts.get("large-response.py")) ?? "";
			observed = {
				first_batch_id: first.batch_id,
				first_ast_size: first_ast_text.length,
				second_batch_id: second.batch_id,
				second_ast_names: [...second.asts.keys()],
			};
		} finally {
			worker.close();
		}
		expect(observed).toEqual({
			first_batch_id: "large-response-batch",
			first_ast_size: expect.any(Number),
			second_batch_id: "large-request-batch",
			second_ast_names: ["large-request.py"],
		});
		expect(observed.first_ast_size).toBeGreaterThan(payload_size);
	}, 15_000);

	test("keeps valid unicode Python expressions in the batch", () => {
		const bridge = new PythonAstBridge();
		const worker = new PythonAstWorker({
			arguments_list: bridge.worker_arguments(),
			options: bridge.worker_options(),
			persistent: true,
			io_timeout_ms: PYTHON_AST_WORKER_IO_TIMEOUT_MS,
		});
		const sources = new Map(Object.entries({ "unicode.py": "éééééééééé = first + second / third\n" }));
		const result = worker.batch_result("unicode-batch", sources);
		worker.close();

		expect([...result.asts.keys()]).toEqual(["unicode.py"]);
	});

	test("bounds a stalled batch and observes worker process exit", async () => {
		const bridge = new PythonAstBridge();
		const worker = new PythonAstWorker({
			arguments_list: ["-c", "while True: pass"],
			options: bridge.worker_options(),
			persistent: true,
			io_timeout_ms: 20,
		});

		const sources = new Map(Object.entries({ "stalled.py": "value = 1\n" }));
		const failure_message = await Promise.resolve()
			.then(() => worker.batch_result("stalled-batch", sources))
			.then(
				() => "",
				(reason: unknown) => String(reason),
			);
		const exit_observed = await Promise.race([
			worker.wait_for_exit().then(() => true),
			new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1000)),
		]);
		expect({
			failure_message,
			exit_observed,
			worker_id: worker.worker_id(),
			has_exited: worker.has_exited(),
		}).toEqual({
			failure_message: expect.stringContaining("Python AST worker response timed out."),
			exit_observed: true,
			worker_id: -1,
			has_exited: true,
		});
	});

	test("bounds stalled worker shutdown and observes process exit", async () => {
		const bridge = new PythonAstBridge();
		const worker = new PythonAstWorker({
			arguments_list: ["-c", "while True: pass"],
			options: bridge.worker_options(),
			persistent: true,
			io_timeout_ms: 20,
		});
		const sources = new Map(Object.entries({ "stalled.py": "value = 1\n" }));
		worker.start_batch("stalled-batch", sources);

		const failure_message = await Promise.resolve()
			.then(() => worker.close())
			.then(
				() => "",
				(reason: unknown) => String(reason),
			);
		const exit_observed = await Promise.race([
			worker.wait_for_exit().then(() => true),
			new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1000)),
		]);
		expect({
			failure_message,
			exit_observed,
			worker_id: worker.worker_id(),
			has_exited: worker.has_exited(),
		}).toEqual({
			failure_message: expect.stringContaining("Python AST worker response timed out."),
			exit_observed: true,
			worker_id: -1,
			has_exited: true,
		});
	});

	test("preserves Python worker stderr in a failed batch", () => {
		const bridge = new PythonAstBridge();
		const diagnostic = "sentinel Python parser failure";
		const script = `import sys\nsys.stderr.write(${JSON.stringify(diagnostic)})\nsys.stderr.flush()\n`;
		const worker = new PythonAstWorker({
			arguments_list: ["-c", script],
			options: bridge.worker_options(),
			persistent: true,
			io_timeout_ms: 1000,
		});

		const sources = new Map(Object.entries({ "failure.py": "value = 1\n" }));
		expect(() => worker.batch_result("stderr-failure", sources)).toThrow(diagnostic);
		expect(worker.worker_id()).toBe(-1);
	});

	test("preserves one-shot bridge stderr and exit details", () => {
		const bridge = new PythonAstBridge();
		const diagnostic = "one-shot parser failure";
		const script = `import sys\nsys.stderr.write(${JSON.stringify(diagnostic)})\nsys.exit(7)\n`;
		const worker = new PythonAstWorker({
			arguments_list: ["-c", script],
			options: bridge.worker_options(),
			persistent: false,
			io_timeout_ms: 1000,
		});

		const sources = new Map(Object.entries({ "failure.py": "value = 1\n" }));
		expect(() => worker.batch_result("one-shot-stderr", sources)).toThrow(`exit status 7; stderr: ${diagnostic}`);
		expect(worker.worker_id()).toBe(-1);
	});

	test("bounds a stalled one-shot bridge process", () => {
		const bridge = new PythonAstBridge();
		const worker = new PythonAstWorker({
			arguments_list: ["-c", "while True: pass"],
			options: bridge.worker_options(),
			persistent: false,
			io_timeout_ms: 20,
		});

		const sources = new Map(Object.entries({ "stalled.py": "value = 1\n" }));
		expect(() => worker.batch_result("one-shot-timeout", sources)).toThrow(/ETIMEDOUT|timed out/u);
		expect(worker.worker_id()).toBe(-1);
	});
});
