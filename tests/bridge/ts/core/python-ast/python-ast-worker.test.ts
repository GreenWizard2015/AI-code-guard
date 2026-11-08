import { randomUUID } from "node:crypto";
import { PYTHON_AST_WORKER_IO_TIMEOUT_MS } from "src/core/python-ast/constants";
import { PythonAstBridge } from "src/core/python-ast/python_ast_bridge";
import { PythonAstWorker } from "src/core/python-ast/python_ast_worker.mjs";
import { PythonAstWorkerRegistry } from "src/core/python-ast/python_ast_worker_registry";

describe("Python AST worker", () => {
	test("reuses one worker for named batches until explicit exit", () => {
		const bridge = new PythonAstBridge();
		const worker = new PythonAstWorker({
			arguments_list: bridge.worker_arguments(),
			options: bridge.worker_options(),
			persistent: true,
			io_timeout_ms: PYTHON_AST_WORKER_IO_TIMEOUT_MS,
		});
		const first_sources = new Map(Object.entries({ first: "class First:\n    pass\n" }));
		const second_sources = new Map(Object.entries({ second: "def second():\n    pass\n" }));
		const first = worker.batch_result("batch-1", first_sources);
		const second = worker.batch_result("batch-2", second_sources);
		worker.close();

		expect({
			first_batch: first.batch_id,
			first_files: [...first.asts.keys()],
			second_batch: second.batch_id,
			second_files: [...second.asts.keys()],
		}).toEqual({
			first_batch: "batch-1",
			first_files: ["first"],
			second_batch: "batch-2",
			second_files: ["second"],
		});
	});

	test("routes out-of-order split completions to the requesting parser", () => {
		const bridge = new PythonAstBridge();
		const worker = new PythonAstWorker({
			arguments_list: bridge.worker_arguments(),
			options: bridge.worker_options(),
			persistent: true,
			io_timeout_ms: PYTHON_AST_WORKER_IO_TIMEOUT_MS,
		});
		const first_sources = new Map(Object.entries({ first: "class First:\n    pass\n" }));
		const second_sources = new Map(Object.entries({ second: "class Second:\n    pass\n" }));
		worker.start_batch("first", first_sources);
		worker.start_batch("second", second_sources);
		const second = worker.complete_batch("second");
		const first = worker.complete_batch("first");
		worker.close();

		expect({
			second: [second.batch_id, [...second.asts.keys()]],
			first: [first.batch_id, [...first.asts.keys()]],
		}).toEqual({
			second: ["second", ["second"]],
			first: ["first", ["first"]],
		});
	});

	test("routes concurrent large batches after both requests start before responses are collected", async () => {
		const bridge = new PythonAstBridge();
		const registry = new PythonAstWorkerRegistry(process);
		const session = registry.worker_session([...bridge.worker_arguments(), randomUUID()], bridge.worker_options());
		const worker = session.worker();
		const first_source = `first_value = '${"a".repeat(80 * 1024)}'\n`;
		const second_source = `second_value = '${"b".repeat(80 * 1024)}'\n`;
		const first_batch = worker.batch("large-first", new Map([["first.py", first_source]]));
		const second_batch = worker.batch("large-second", new Map([["second.py", second_source]]));
		let observed: {
			first_batch_id: string;
			first_files: string[];
			second_batch_id: string;
			second_files: string[];
			both_sources_exceed_64_kib: boolean;
		} = {
			first_batch_id: "",
			first_files: [],
			second_batch_id: "",
			second_files: [],
			both_sources_exceed_64_kib: false,
		};

		try {
			first_batch.start();
			second_batch.start();
			const first_result = first_batch.complete();
			const second_result = second_batch.complete();
			observed = {
				first_batch_id: first_result.batch_id,
				first_files: [...first_result.asts.keys()],
				second_batch_id: second_result.batch_id,
				second_files: [...second_result.asts.keys()],
				both_sources_exceed_64_kib: [first_source, second_source].every(
					(source) => Buffer.byteLength(source) > 64 * 1024,
				),
			};
		} finally {
			await session.close();
		}
		expect(observed).toEqual({
			first_batch_id: "large-first",
			first_files: ["first.py"],
			second_batch_id: "large-second",
			second_files: ["second.py"],
			both_sources_exceed_64_kib: true,
		});
	}, 30000);

	test("reports a worker that exits before returning a batch", () => {
		const bridge = new PythonAstBridge();
		const worker = new PythonAstWorker({
			arguments_list: ["-c", "raise SystemExit(7)"],
			options: bridge.worker_options(),
			persistent: true,
			io_timeout_ms: 1000,
		});

		expect(() => worker.batch_result("failed", new Map<string, string>())).toThrow(
			"Python AST worker exited before returning a response.",
		);
		expect(worker.worker_id()).toBe(-1);
	});

	test("returns AST values under the submitted source names", () => {
		const bridge = new PythonAstBridge();
		const worker = new PythonAstWorker({
			arguments_list: bridge.worker_arguments(),
			options: bridge.worker_options(),
			persistent: true,
			io_timeout_ms: PYTHON_AST_WORKER_IO_TIMEOUT_MS,
		});
		const sources = new Map(
			Object.entries({
				"first.py": "class First:\n    pass\n",
				"second.py": "def second():\n    pass\n",
			}),
		);
		const result = worker.batch_result("named-batch", sources);
		worker.close();

		expect([...result.asts.keys()]).toEqual(["first.py", "second.py"]);
	});

	test("emits owners for top-level and nested Python callables", () => {
		const bridge = new PythonAstBridge();
		const worker = new PythonAstWorker({
			arguments_list: bridge.worker_arguments(),
			options: bridge.worker_options(),
			persistent: true,
			io_timeout_ms: PYTHON_AST_WORKER_IO_TIMEOUT_MS,
		});
		const source = [
			"def outer():",
			"    def inner():",
			"        return 1",
			"    return inner()",
			"",
			"class Service:",
			"    def run(self):",
			"        def local():",
			"            return 2",
			"        return local()",
		].join("\n");
		const sources = new Map(Object.entries({ "owners.py": source }));
		const result = worker.batch_result("callable-owners", sources);
		worker.close();
		const ast = result.asts.get("owners.py");

		let actual_functions: string[][] = [];
		if (ast !== undefined) {
			actual_functions = ast.source.functions.map((callable: { identity: { name: string; owner: string } }) => [
				callable.identity.name,
				callable.identity.owner,
			]);
		}
		expect(actual_functions).toEqual([
			["outer", ""],
			["inner", "outer"],
			["local", "run"],
		]);
	});

	test("reads responses larger than one worker chunk", () => {
		const bridge = new PythonAstBridge();
		const worker = new PythonAstWorker({
			arguments_list: bridge.worker_arguments(),
			options: bridge.worker_options(),
			persistent: true,
			io_timeout_ms: PYTHON_AST_WORKER_IO_TIMEOUT_MS,
		});
		const source = `class Large:\n${"    value = 1\n".repeat(256)}`;
		const sources = new Map(Object.entries({ "large.py": source }));
		const result = worker.batch_result("large-batch", sources);
		worker.close();

		expect({
			files: [...result.asts.keys()],
			response_bytes: Buffer.byteLength(JSON.stringify(Object.fromEntries(result.asts))) > 64 * 1024,
		}).toEqual({ files: ["large.py"], response_bytes: true });
	});
});
