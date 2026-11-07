import { describe, expect, test } from "@jest/globals";
import { PYTHON_AST_WORKER_INACTIVE_LEASE_MESSAGE } from "src/core/python-ast/constants";
import { PythonAstWorkerRegistry } from "src/core/python-ast/python_ast_worker_registry";
import { PythonAstWorkerLeaseFixture } from "tests/bridge/ts/core/python-ast/python_ast_worker_lease_fixture";

describe("Python worker batch leases", () => {
	test("keeps a peer batch usable after owner release", async () => {
		const fixture = new PythonAstWorkerLeaseFixture("pending-peer");
		const state = fixture.state();
		const registry = new PythonAstWorkerRegistry(process);
		const first = registry.worker_session(state.arguments_list, state.options);
		const peer = registry.worker_session(state.arguments_list, state.options);
		const batch = peer.worker().batch("shared-pending", new Map([["pending.py", "value = 2\n"]]));
		batch.start();
		await first.close();
		const result = batch.complete();
		await peer.close();
		fixture.cleanup();

		expect([...result.asts.keys()]).toEqual(["pending.py"]);
		expect(state.worker.has_exited()).toBe(true);
	});

	test("closes the worker after its final lease ends", async () => {
		const fixture = new PythonAstWorkerLeaseFixture("final-release");
		const state = fixture.state();
		const registry = new PythonAstWorkerRegistry(process);
		const first = registry.worker_session(state.arguments_list, state.options);
		const second = registry.worker_session(state.arguments_list, state.options);
		await first.close();
		const open_after_first_release = !state.worker.has_exited();
		await second.close();
		fixture.cleanup();

		expect({
			open_after_first_release,
			closed_after_final_release: state.worker.has_exited(),
			registry_entry_removed: !state.registry_entries.has(state.key),
		}).toEqual({ open_after_first_release: true, closed_after_final_release: true, registry_entry_removed: true });
	});

	test("rejects a batch after its lease ends", async () => {
		const fixture = new PythonAstWorkerLeaseFixture("owned-release");
		const state = fixture.state();
		const registry = new PythonAstWorkerRegistry(process);
		const owner = registry.worker_session(state.arguments_list, state.options);
		const peer = registry.worker_session(state.arguments_list, state.options);
		const batch = owner.worker().batch("released-owner", new Map([["closed.py", "value = 3\n"]]));
		await owner.close();
		const peer_lease_active = !state.worker.has_exited();
		await peer.close();
		fixture.cleanup();

		expect(() => batch.result()).toThrow(PYTHON_AST_WORKER_INACTIVE_LEASE_MESSAGE);
		expect(peer_lease_active).toBe(true);
	});

	test("completes a peer batch after another lease ends", async () => {
		const fixture = new PythonAstWorkerLeaseFixture("peer-completion");
		const state = fixture.state();
		const registry = new PythonAstWorkerRegistry(process);
		const owner = registry.worker_session(state.arguments_list, state.options);
		const peer = registry.worker_session(state.arguments_list, state.options);
		const batch = peer.worker().batch("live-peer", new Map([["peer.py", "value = 4\n"]]));
		batch.start();
		await owner.close();
		const result = batch.complete();
		await peer.close();
		fixture.cleanup();

		expect([...result.asts.keys()]).toEqual(["peer.py"]);
	});
});
