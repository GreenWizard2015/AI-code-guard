import type { ChildProcess } from "node:child_process";
import { MAX_RETAINED_AGENT_OUTPUT_CHARACTERS } from "src/core/support/task/review-agent/constants";
import type { ReviewAgentAsyncOutput, ReviewAgentOutputStream } from "src/core/support/task/review-agent/types";

/** Responsibilities: _bounded agent output collection_, _stdout and stderr subscriptions_. **/
export class ReviewAgentOutputCollector {
	private readonly output: ReviewAgentAsyncOutput;

	/** Responsibilities: _stream output retention_. **/
	private retain(stream_name: ReviewAgentOutputStream, chunk: string): void {
		const current = this.output[stream_name];
		const updated = `${current}${chunk}`.slice(-MAX_RETAINED_AGENT_OUTPUT_CHARACTERS);
		this.output[stream_name] = updated;
	}

	/** Responsibilities: _child output stream subscription_. **/
	private attach_stream(child: ChildProcess, stream_name: ReviewAgentOutputStream): void {
		const stream = child[stream_name];
		if (stream === null || stream === undefined) {
			return;
		}
		stream.setEncoding("utf8");
		stream.on("data", (chunk: string) => this.retain(stream_name, chunk));
	}

	/** Responsibilities: _agent output ownership_. **/
	public constructor(output: ReviewAgentAsyncOutput) {
		this.output = output;
	}

	/** Responsibilities: _stdout stream subscription_. **/
	public attach_stdout(child: ChildProcess): void {
		this.attach_stream(child, "stdout");
	}

	/** Responsibilities: _stderr stream subscription_. **/
	public attach_stderr(child: ChildProcess): void {
		this.attach_stream(child, "stderr");
	}
}
