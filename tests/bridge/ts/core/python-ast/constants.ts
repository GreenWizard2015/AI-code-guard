export const PYTHON_PATH_VARIABLE = "PYTHONPATH";

export const PYTHON_WORKER_LIFECYCLE_SCRIPT = `
	const { parentPort, workerData } = require("node:worker_threads");
	parentPort.unref();
	(async () => {
		const { PythonAstWorker } = await import(workerData.worker_module);
		const worker = new PythonAstWorker({
			arguments_list: workerData.worker_arguments,
			options: workerData.worker_options,
			persistent: true,
			io_timeout_ms: workerData.io_timeout_ms,
		});
		worker.batch_result("shutdown-check", new Map([["shutdown.py", "value = 1\\n"]]));
		worker.close();
		await worker.wait_for_exit();
		parentPort.postMessage("worker exit observed");
	})().catch((error) => {
		parentPort.postMessage({ error: String(error) });
		process.exitCode = 1;
	});
`;
