import type { NormalizedAstFile } from 'src/types';
import type { SpawnOptions } from 'node:child_process';

export type PythonAstWorkerSources = { [name: string]: string };
export type PythonAstStageTiming = {
	name: string;
	duration_ms: number;
};
export type PythonAstWorkerTimings = {
	ast_parse_ms: number;
	ast_build_ms: number;
	ast_stages: PythonAstStageTiming[];
};

export type PythonAstWorkerResponse = {
	batchId: string;
	asts: { [name: string]: NormalizedAstFile };
	timings: PythonAstWorkerTimings;
};

export declare class PythonAstWorker {
	constructor(arguments_list: string[], options: SpawnOptions, persistent: boolean);
	batch_result(batch_id: string, sources: PythonAstWorkerSources): PythonAstWorkerResponse;
	close(): void;
}
