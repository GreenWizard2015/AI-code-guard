import { MAX_RETAINED_OUTPUT_CHARACTERS } from "src/core/support/task/review-agent/constants";
import type {
	CallableReviewAgentOutputSnapshotReader,
	ReviewAgentAsyncOutput,
	ReviewAgentChildProcessContract,
	ReviewAgentOutputBufferContract,
	ReviewAgentOutputChannel,
} from "src/core/support/task/review-agent/protocols";

/** Responsibilities: _bounded output snapshots_, _stdout and stderr accumulation_. **/
export class ReviewAgentOutputBuffer implements ReviewAgentOutputBufferContract {
	private readonly _stdout_text: string;
	private readonly _stderr_text: string;
	private readonly _output_snapshot: ReviewAgentAsyncOutput;

	/** Responsibilities: _output snapshot initialization_. **/
	public constructor(stdout_text = "", stderr_text = "") {
		this._stdout_text = stdout_text;
		this._stderr_text = stderr_text;
		this._output_snapshot = { stdout: stdout_text, stderr: stderr_text };
	}

	/** Responsibilities: _process stream attachment_. **/
	public capture(child: ReviewAgentChildProcessContract): CallableReviewAgentOutputSnapshotReader {
		let output: ReviewAgentOutputBufferContract = new ReviewAgentOutputBuffer();
		child.stdout_stream().setEncoding("utf8");
		child.stdout_stream().on("data", (chunk: string) => {
			output = output.append("stdout", chunk);
		});
		child.stderr_stream().setEncoding("utf8");
		child.stderr_stream().on("data", (chunk: string) => {
			output = output.append("stderr", chunk);
		});
		return (): ReviewAgentAsyncOutput => output.snapshot();
	}

	/** Responsibilities: _stdout and stderr snapshot_. **/
	public snapshot(): ReviewAgentAsyncOutput {
		return this._output_snapshot;
	}

	/** Responsibilities: _bounded output transition_. **/
	public append(channel: ReviewAgentOutputChannel, chunk: string): ReviewAgentOutputBufferContract {
		if (channel === "stdout") {
			return new ReviewAgentOutputBuffer(
				`${this._stdout_text}${chunk}`.slice(-MAX_RETAINED_OUTPUT_CHARACTERS),
				this._stderr_text,
			);
		}
		return new ReviewAgentOutputBuffer(
			this._stdout_text,
			`${this._stderr_text}${chunk}`.slice(-MAX_RETAINED_OUTPUT_CHARACTERS),
		);
	}
}
