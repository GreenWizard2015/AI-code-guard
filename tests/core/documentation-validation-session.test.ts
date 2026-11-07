import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { DocumentationValidationSession } from "src/core/support/documentation_validation_session";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { DocumentationWorkerSessionProvider } from "tests/core/documentation-worker-session-provider";

describe("documentation validation worker session lifecycle", () => {
	test("waits for worker cleanup before completing the session", async () => {
		const worker = new DocumentationWorkerSessionProvider();
		const configuration = new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd()));
		const lint_runner = new DocumentationValidationSession(configuration, worker);
		let result_settled = false;
		const result = lint_runner.with_worker(async () => 17);
		const observed_result = result.then(() => {
			result_settled = true;
		});
		await new Promise<void>((resolve) => setImmediate(resolve));
		const settled_before_close = result_settled;
		worker.finish_cleanup();
		await observed_result;
		expect({ settled_before_close, settled_after_close: result_settled }).toEqual({
			settled_before_close: false,
			settled_after_close: true,
		});
	});

	test("returns the session operation result after worker cleanup", async () => {
		const worker = new DocumentationWorkerSessionProvider();
		const configuration = new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd()));
		const lint_runner = new DocumentationValidationSession(configuration, worker);
		const result = lint_runner.with_worker(async () => 17);
		worker.finish_cleanup();
		const operation_result = await result;
		expect(operation_result).toBe(17);
	});

	test("awaits worker cleanup before propagating a validation failure", async () => {
		const worker = new DocumentationWorkerSessionProvider();
		const configuration = new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd()));
		const lint_runner = new DocumentationValidationSession(configuration, worker);
		const failure = new Error("validation sentinel");
		let result_settled = false;
		const result = lint_runner.with_worker(() => Promise.reject(failure));
		const observed = result.then(
			() => ({ original_failure: false }),
			(error: unknown) => {
				result_settled = true;
				return { original_failure: error === failure };
			},
		);
		await new Promise<void>((resolve) => setImmediate(resolve));
		const settled_before_cleanup = result_settled;
		worker.finish_cleanup();
		const outcome = await observed;

		expect({ settled_before_cleanup, original_failure: outcome.original_failure }).toEqual({
			settled_before_cleanup: false,
			original_failure: true,
		});
	});
});
