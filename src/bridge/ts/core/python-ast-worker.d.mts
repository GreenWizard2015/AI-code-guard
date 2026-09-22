import type { NormalizedAstFile } from 'src/types';
import type { SpawnOptions } from 'node:child_process';

export type PythonAstWorkerSources = { [name: string]: string };

export type PythonAstWorkerResponse = {
	batchId: string;
	asts: { [name: string]: NormalizedAstFile };
};

export declare class PythonAstWorker {
	constructor(arguments_list: string[], options: SpawnOptions, persistent: boolean);
	batch_result(batch_id: string, sources: PythonAstWorkerSources): PythonAstWorkerResponse;
	close(): void;
}
