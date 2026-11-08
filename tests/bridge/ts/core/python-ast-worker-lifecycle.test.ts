import { describe, expect, test } from "@jest/globals";
import { AstModel } from "src/core/ast_model";
import { PYTHON_AST_MISSING_SPLIT_BATCH_MESSAGE } from "src/core/python-ast/constants";
import { PythonAstData } from "src/core/python-ast/python_ast_data";
import { PythonAstWorkerRegistry } from "src/core/python-ast/python_ast_worker_registry";
import { LintStageTimer } from "src/lint_stage_timer";
import { PythonAstCacheConsumerFixture } from "tests/bridge/ts/core/python-ast-cache-consumer-fixture";
import { PythonAstWorkerLeaseFixture } from "tests/bridge/ts/core/python-ast/python_ast_worker_lease_fixture";
import { PythonCacheWorker } from "tests/bridge/ts/core/python-cache-worker";

describe("Python AST worker lease lifecycle", () => {
	test("reclaims a pending batch when its lease closes", async () => {
		const fixture = new PythonAstWorkerLeaseFixture("pending-release");
		const state = fixture.state();
		const registry = new PythonAstWorkerRegistry(process);
		const session = registry.worker_session(state.arguments_list, state.options);
		const worker = session.worker();
		const batch = worker.batch("pending", new Map([["module.py", "value = 1\n"]]));
		batch.start();
		await session.close();
		const cancelled_batches = state.worker.cancelled_batch_ids();
		fixture.cleanup();

		expect(cancelled_batches).toEqual(["pending"]);
	});

	test("waits for actual child exit before lease close completes", async () => {
		const fixture = new PythonAstWorkerLeaseFixture("delayed-exit");
		const state = fixture.state();
		state.worker.defer_exit();
		const close_requested = state.worker.wait_for_close_request();
		const registry = new PythonAstWorkerRegistry(process);
		const session = registry.worker_session(state.arguments_list, state.options);
		const close_completion = session.close();
		const settled_before_exit = await Promise.race([
			close_completion.then(
				() => true,
				() => true,
			),
			close_requested.then(() => false),
		]);
		state.worker.complete_exit();
		await close_completion;
		fixture.cleanup();

		expect({
			settled_before_exit,
			exit_requested: state.worker.exit_requested(),
			exited: state.worker.has_exited(),
		}).toEqual({
			settled_before_exit: false,
			exit_requested: true,
			exited: true,
		});
	});

	test("releases parser preparation with its owning lease", async () => {
		const fixture = new PythonAstWorkerLeaseFixture("parser-release");
		const state = fixture.state();
		const registry = new PythonAstWorkerRegistry(process);
		const session = registry.worker_session(state.arguments_list, state.options);
		const cache = new PythonAstCacheConsumerFixture();
		const parser = new PythonAstData({
			worker: session.worker(),
			analysis_identity: cache._project._identity,
			split_batch_enabled: true,
			file_io: cache._project._file_io,
			cache_enabled: false,
		});
		const pending_batch = parser.begin_batch_ast({
			texts: ["value = 2\n"],
			files: [cache._file],
			repo_root: "",
			stage_timer: new LintStageTimer(),
			stage_prefix: "python-bridge",
		});
		await session.close();
		const completion_result = await Promise.resolve()
			.then(() => parser.complete_batch_ast(pending_batch))
			.then(
				() => "",
				(error) => String(error),
			);
		const cancelled_batches = state.worker.cancelled_batch_ids();
		fixture.cleanup();

		expect(completion_result).toBe(`Error: ${PYTHON_AST_MISSING_SPLIT_BATCH_MESSAGE}`);
		expect(cancelled_batches).toEqual([pending_batch]);
	});

	test("registry shutdown cancels a pending parser batch", async () => {
		const fixture = new PythonAstWorkerLeaseFixture("registry-parser-release");
		const state = fixture.state();
		const registry = new PythonAstWorkerRegistry(process);
		const session = registry.worker_session(state.arguments_list, state.options);
		const cache = new PythonAstCacheConsumerFixture();
		const parser = new PythonAstData({
			worker: session.worker(),
			analysis_identity: cache._project._identity,
			split_batch_enabled: true,
			file_io: cache._project._file_io,
			cache_enabled: false,
		});
		const pending_batch = parser.begin_batch_ast({
			texts: ["value = 3\n"],
			files: [cache._file],
			repo_root: "",
			stage_timer: new LintStageTimer(),
			stage_prefix: "python-bridge",
		});
		await registry.close();
		const completion_attempt = Promise.resolve().then(() => parser.complete_batch_ast(pending_batch));
		const completion_result = await completion_attempt.then(
			() => "",
			(error) => String(error),
		);
		const cancelled_batches = state.worker.cancelled_batch_ids();
		fixture.cleanup();

		expect(completion_result).toBe(`Error: ${PYTHON_AST_MISSING_SPLIT_BATCH_MESSAGE}`);
		expect(cancelled_batches).toContain(pending_batch);
	});

	test("waits for child exit after a worker close failure", async () => {
		const fixture = new PythonAstWorkerLeaseFixture("shutdown-retry");
		const state = fixture.state();
		const registry = new PythonAstWorkerRegistry(process);
		state.worker.fail_close_times(1);
		state.worker.defer_exit();
		const close_requested = state.worker.wait_for_close_request();
		const shutdown_completion = registry.close();
		const close_completion = shutdown_completion.then(
			() => "",
			(error) => String(error),
		);
		const settled_before_exit = await Promise.race([
			close_completion.then(
				() => true,
				() => true,
			),
			close_requested.then(() => false),
		]);
		state.worker.complete_exit();
		const first_close_error = await close_completion;
		fixture.cleanup();

		expect({ first_close_error, settled_before_exit }).toEqual({
			first_close_error: "AggregateError: One or more Python AST workers failed to close.",
			settled_before_exit: false,
		});
	});

	test("continues closing later workers after one close failure", async () => {
		const fixture = new PythonAstWorkerLeaseFixture("shutdown-continuation");
		const state = fixture.state();
		const registry = new PythonAstWorkerRegistry(process);
		const model = new AstModel("python");
		const empty_ast = model.empty_ast_file();
		const later_worker = new PythonCacheWorker(empty_ast);
		state.registry_entries.set("later-worker", { worker: later_worker, leases: new Set<string>() });
		state.worker.fail_close_times(1);
		const shutdown = registry.close();
		const shutdown_error = await shutdown.then(
			() => "",
			(error) => String(error),
		);
		const later_worker_closed = later_worker.close_call_count() === 1;
		fixture.cleanup();

		expect({ shutdown_error, later_worker_closed }).toEqual({
			shutdown_error: "AggregateError: One or more Python AST workers failed to close.",
			later_worker_closed: true,
		});
	});

	test("retains a failed worker for a later shutdown retry", async () => {
		const fixture = new PythonAstWorkerLeaseFixture("shutdown-retry");
		const state = fixture.state();
		const registry = new PythonAstWorkerRegistry(process);
		state.worker.fail_close_times(1);
		const first_shutdown = registry.close();
		await first_shutdown.then(
			() => "",
			(error) => String(error),
		);
		const retained_after_failure = state.registry_entries.has(state.key);
		await registry.close();
		const removed_after_retry = !state.registry_entries.has(state.key);
		fixture.cleanup();

		expect({ retained_after_failure, removed_after_retry }).toEqual({
			retained_after_failure: true,
			removed_after_retry: true,
		});
	});
});
