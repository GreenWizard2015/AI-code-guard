import { EventEmitter, once } from "node:events";
import type { WorkerSessionLeaseContract, WorkerSessionProviderContract } from "src/runtime_protocols";

/** Responsibilities: _worker cleanup coordination_, _lease activity tracking_. **/
export class DocumentationWorkerSessionProvider implements WorkerSessionProviderContract, WorkerSessionLeaseContract {
	private readonly _close_signal: EventEmitter;
	private readonly _close_promise: Promise<void>;
	private _active: boolean;

	/** Responsibilities: _worker lifecycle initialization_. **/
	public constructor() {
		this._close_signal = new EventEmitter();
		this._active = true;
		this._close_promise = once(this._close_signal, "close").then(() => {
			this._active = false;
		});
	}

	/** Responsibilities: _worker lease access_. **/
	public active_worker_session(): WorkerSessionLeaseContract {
		return this;
	}

	/** Responsibilities: _worker activity access_. **/
	public active(): boolean {
		return this._active;
	}

	/** Responsibilities: _worker lease cleanup_. **/
	public async close(): Promise<void> {
		await this._close_promise;
	}

	/** Responsibilities: _worker session cleanup_. **/
	public async close_worker_session(): Promise<void> {
		await this._close_promise;
	}

	/** Responsibilities: _worker cleanup signaling_. **/
	public finish_cleanup(): void {
		this._close_signal.emit("close");
	}
}
