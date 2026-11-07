import { randomUUID } from "node:crypto";
import { describe, expect, test } from "@jest/globals";
import { PYTHON_AST_WORKER_INACTIVE_LEASE_MESSAGE } from "src/core/python-ast/constants";
import { PythonAstBridge } from "src/core/python-ast/python_ast_bridge";
import { PythonAstWorkerRegistry } from "src/core/python-ast/python_ast_worker_registry";

describe("Python worker registry leases", () => {
	test("closes registered workers when the registry shuts down", async () => {
		const bridge = new PythonAstBridge();
		const registry = new PythonAstWorkerRegistry(process);
		const session = registry.worker_session(bridge.worker_arguments(), bridge.worker_options());
		const worker = session.worker();
		const batch = worker.batch("registry-close", new Map([["worker.py", "value = 1\n"]])).result();
		const inactive_batch = worker.batch("after-registry-close", new Map());

		registry.close();
		await session.close();
		expect([...batch.asts.keys()]).toEqual(["worker.py"]);
		expect(() => inactive_batch.result()).toThrow(PYTHON_AST_WORKER_INACTIVE_LEASE_MESSAGE);
	});

	test("gives shared leases distinct capabilities", async () => {
		const bridge = new PythonAstBridge();
		const args = [...bridge.worker_arguments(), randomUUID()];
		const registry = new PythonAstWorkerRegistry(process);
		const first = registry.worker_session(args, bridge.worker_options());
		const shared = registry.worker_session(args, bridge.worker_options());
		const distinct = first.worker() !== shared.worker();
		await first.close();
		await shared.close();

		expect(distinct).toBe(true);
	});

	test("keeps the worker usable through the remaining lease", async () => {
		const bridge = new PythonAstBridge();
		const args = [...bridge.worker_arguments(), randomUUID()];
		const registry = new PythonAstWorkerRegistry(process);
		const first = registry.worker_session(args, bridge.worker_options());
		const shared = registry.worker_session(args, bridge.worker_options());
		const first_result = first
			.worker()
			.batch("lease-first", new Map([["first.py", "value = 1\n"]]))
			.result();
		await first.close();
		const shared_result = shared
			.worker()
			.batch("lease-second", new Map([["second.py", "value = 2\n"]]))
			.result();
		await shared.close();

		expect([...first_result.asts.keys()]).toEqual(["first.py"]);
		expect([...shared_result.asts.keys()]).toEqual(["second.py"]);
	});

	test("isolates sessions with different process configurations", async () => {
		const bridge = new PythonAstBridge();
		const args = [...bridge.worker_arguments(), randomUUID()];
		const registry = new PythonAstWorkerRegistry(process);
		const first_options = bridge.worker_options();
		const second_options = { ...bridge.worker_options(), cwd: `${process.cwd()}/src` };
		const first = registry.worker_session(args, first_options);
		const second = registry.worker_session(args, second_options);
		const first_worker = first.worker();
		const second_worker = second.worker();
		const workers_are_distinct = first_worker !== second_worker;
		await first.close();
		await second.close();

		expect(workers_are_distinct).toBe(true);
	});

	test("keeps the differently configured worker usable after its peer closes", async () => {
		const bridge = new PythonAstBridge();
		const args = [...bridge.worker_arguments(), randomUUID()];
		const registry = new PythonAstWorkerRegistry(process);
		const first = registry.worker_session(args, bridge.worker_options());
		const second_options = { ...bridge.worker_options(), cwd: `${process.cwd()}/src` };
		const second = registry.worker_session(args, second_options);
		await first.close();
		const second_result = second
			.worker()
			.batch("surviving-lease", new Map([["second.py", "value = 2\n"]]))
			.result();
		await second.close();

		expect([...second_result.asts.keys()]).toEqual(["second.py"]);
	});
});
