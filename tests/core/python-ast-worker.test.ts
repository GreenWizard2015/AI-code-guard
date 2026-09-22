import { PythonAstBridge } from 'src/bridge/ts/core/python-ast-bridge';
import { PythonAstWorker } from 'src/bridge/ts/core/python-ast-worker.mjs';

describe('Python AST worker', () => {
	test('reuses one worker for named batches until explicit exit', () => {
		const bridge = new PythonAstBridge();
		const worker = new PythonAstWorker(bridge.worker_arguments(), bridge.worker_options(), true);
		const first = worker.batch_result('batch-1', { first: 'class First:\n    pass\n' });
		const second = worker.batch_result('batch-2', { second: 'def second():\n    pass\n' });
		worker.close();

		expect({
			first_batch: first.batchId,
			first_files: Object.keys(first.asts),
			second_batch: second.batchId,
			second_files: Object.keys(second.asts),
		}).toEqual({
			first_batch: 'batch-1',
			first_files: ['first'],
			second_batch: 'batch-2',
			second_files: ['second'],
		});
	});

	test('returns AST values under the submitted source names', () => {
		const bridge = new PythonAstBridge();
		const worker = new PythonAstWorker(bridge.worker_arguments(), bridge.worker_options(), true);
		const result = worker.batch_result('named-batch', {
			'first.py': 'class First:\n    pass\n',
			'second.py': 'def second():\n    pass\n',
		});
		worker.close();

		expect(Object.keys(result.asts)).toEqual(['first.py', 'second.py']);
	});
});
