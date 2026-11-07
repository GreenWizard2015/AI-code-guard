import { EventEmitter } from "node:events";
import type { Readable } from "node:stream";
import type {
	CallableReviewAgentChildCloseListener,
	CallableReviewAgentChildErrorListener,
	ReviewAgentChildProcessContract,
} from "src/core/support/task/review-agent/protocols";

/** Responsibilities: _fake child process state_, _fake child events_. **/
export class ReviewAgentChildProcess extends EventEmitter implements ReviewAgentChildProcessContract {
	private readonly _pid: number;
	private readonly _stdout: Readable;
	private readonly _stderr: Readable;

	/** Responsibilities: _child process configuration_. **/
	public constructor(pid: number, stdout: Readable, stderr: Readable) {
		super();
		this._pid = pid;
		this._stdout = stdout;
		this._stderr = stderr;
	}

	/** Responsibilities: _process identity state_. **/
	public identified(): boolean {
		return true;
	}

	/** Responsibilities: _process identifier_. **/
	public identifier(): number {
		return this._pid;
	}

	/** Responsibilities: _stdout stream_. **/
	public stdout_stream(): Readable {
		return this._stdout;
	}

	/** Responsibilities: _stderr stream_. **/
	public stderr_stream(): Readable {
		return this._stderr;
	}

	/** Responsibilities: _error event subscription_. **/
	public on_error(listener: CallableReviewAgentChildErrorListener): void {
		this.once("error", listener);
	}

	/** Responsibilities: _process completion notification_. **/
	public on_close(listener: CallableReviewAgentChildCloseListener): void {
		this.once("close", listener);
	}

	/** Responsibilities: _termination result_. **/
	public kill(): boolean {
		return true;
	}
}
