import type { ChildProcess } from "node:child_process";
import { Readable } from "node:stream";
import type {
	CallableReviewAgentChildCloseListener,
	CallableReviewAgentChildErrorListener,
	ReviewAgentChildProcessContract,
} from "src/core/support/task/review-agent/protocols";

/** Responsibilities: _Node child process adaptation_, _child stream access_. **/
export class NodeReviewAgentChildProcess implements ReviewAgentChildProcessContract {
	private readonly _child: ChildProcess;

	/** Responsibilities: _Node child process ownership_. **/
	public constructor(child: ChildProcess) {
		this._child = child;
	}

	/** Responsibilities: _child process identifier availability_. **/
	public identified(): boolean {
		return this._child.pid !== undefined;
	}

	/** Responsibilities: _child process identifier access_. **/
	public identifier(): number {
		const pid = this._child.pid;
		if (pid === undefined) {
			throw new Error("Review child process has no process id");
		}
		return pid;
	}

	/** Responsibilities: _child stdout access_. **/
	public stdout_stream(): Readable {
		const stream = this._child.stdout;
		if (stream !== null) {
			return stream;
		}
		return Readable.from([]);
	}

	/** Responsibilities: _child stderr access_. **/
	public stderr_stream(): Readable {
		const stream = this._child.stderr;
		if (stream !== null) {
			return stream;
		}
		return Readable.from([]);
	}

	/** Responsibilities: _child error subscription_. **/
	public on_error(listener: CallableReviewAgentChildErrorListener): void {
		this._child.once("error", listener);
	}

	/** Responsibilities: _process completion notification_. **/
	public on_close(listener: CallableReviewAgentChildCloseListener): void {
		this._child.once("close", (code) => {
			if (code === null) {
				listener({ received: false, code: 1 });
				return;
			}
			listener({ received: true, code });
		});
	}

	/** Responsibilities: _child termination_. **/
	public kill(signal: NodeJS.Signals): boolean {
		return this._child.kill(signal);
	}
}
