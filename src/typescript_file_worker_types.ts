import type { MessagePort } from "node:worker_threads";

/** Responsibilities: _worker AST parse source_. **/
export type TypeScriptWorkerParseSource = {
	file: string;
	text: string;
};

/** Responsibilities: _worker AST parse payload_. **/
export type TypeScriptWorkerParseSnapshot = {
	sources: readonly TypeScriptWorkerParseSource[];
	enqueued_at_ms: number;
};

/** Responsibilities: _worker entry request_. **/
export type TypeScriptWorkerBootstrapInput = {
	files: readonly string[];
	control: SharedArrayBuffer;
	port: MessagePort;
	typescript_module_name: string;
};

/** Responsibilities: _worker analysis input_. **/

export type TypeScriptWorkerInput = {
	files: readonly string[];
	control: SharedArrayBuffer;
	port: MessagePort;
	typescript_module_name: string;
	snapshot: TypeScriptWorkerParseSnapshot;
};
