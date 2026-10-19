import type { ChildProcess } from "node:child_process";

export interface PythonAstWorkerTransportContract {
	attach(child: ChildProcess, worker_error: (message: string) => Error): void;
	set_response(frame: Buffer): void;
	read_frame(): string;
	write_frame(payload: string): void;
	close(): void;
}

export declare class PythonAstWorkerTransport implements PythonAstWorkerTransportContract {
	constructor(io_timeout_ms?: number);
	attach(child: ChildProcess, worker_error: (message: string) => Error): void;
	set_response(frame: Buffer): void;
	read_frame(): string;
	write_frame(payload: string): void;
	close(): void;
}
