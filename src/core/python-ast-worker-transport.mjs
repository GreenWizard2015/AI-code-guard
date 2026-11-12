// @ts-check
import { readSync, writeSync } from "node:fs";
import { performance } from "node:perf_hooks";

/** @typedef {(message: string) => Error} WorkerErrorFactory */
/** @typedef {{ _handle?: { fd?: number }; unref(): void }} WorkerPipe */
/** Responsibilities: _Python worker frame transport_, _blocking I/O deadlines_. **/
export class PythonAstWorkerTransport {
	/** @param {number} [io_timeout_ms] */
	constructor(io_timeout_ms = 30_000) {
		/** @type {number} */
		this.io_timeout_ms = io_timeout_ms;
		/** @type {number | null} */
		this.input_fd = null;
		/** @type {number | null} */
		this.output_fd = null;
		/** @type {Buffer[]} */
		this.response_chunks = [];
		/** @type {number} */
		this.response_length = 0;
		/** @type {Int32Array} */
		this.wait_buffer = new Int32Array(new SharedArrayBuffer(4));
		/** @type {WorkerErrorFactory} */
		this.worker_error = (message) => new Error(message);
	}
	/** @param {import("node:child_process").ChildProcess} child @param {WorkerErrorFactory} worker_error */
	attach(child, worker_error) {
		/** @type {WorkerPipe | null} */
		const input = /** @type {WorkerPipe | null} */ (child.stdin);
		/** @type {WorkerPipe | null} */
		const output = /** @type {WorkerPipe | null} */ (child.stdout);
		if (input === null || input === undefined || output === null || output === undefined) {
			throw new Error("Python AST worker pipes were not created.");
		}
		const input_fd = input._handle?.fd;
		const output_fd = output._handle?.fd;
		if (typeof input_fd !== "number" || !Number.isInteger(input_fd)) {
			throw new Error("Python AST worker requires native Node child-process pipes.");
		}
		if (typeof output_fd !== "number" || !Number.isInteger(output_fd)) {
			throw new Error("Python AST worker requires native Node child-process pipes.");
		}
		this.input_fd = input_fd ?? null;
		this.output_fd = output_fd ?? null;
		this.worker_error = worker_error;
		child.unref();
		input.unref();
		output.unref();
	}
	/** @param {Buffer} frame */
	set_response(frame) {
		this.response_chunks = [Buffer.from(frame)];
		this.response_length = frame.length;
	}
	/** @param {number} deadline @param {string} message @returns {void} */
	wait_for_io(deadline, message) {
		const remaining = deadline - performance.now();
		if (remaining <= 0) {
			throw this.worker_error(message);
		}
		Atomics.wait(this.wait_buffer, 0, 0, Math.min(8, remaining));
	}
	/** @param {number} deadline @returns {void} */
	append_response_bytes(deadline) {
		while (true) {
			try {
				this.read_response_bytes();
				return;
			} catch (error) {
				if (!this.is_retryable_io_error(error)) {
					throw error;
				}
				this.wait_for_io(deadline, "Python AST worker response timed out.");
			}
		}
	}
	/** @returns {void} */
	read_response_bytes() {
		const buffer = Buffer.allocUnsafe(64 * 1024);
		const output_fd = this.output_fd;
		if (output_fd === null) {
			throw new Error("Python AST worker output pipe is closed.");
		}
		const count = readSync(output_fd, buffer, 0, buffer.length, null);
		if (count === 0) {
			throw this.worker_error("Python AST worker exited before returning a response.");
		}
		this.response_chunks.push(buffer.subarray(0, count));
		this.response_length += count;
	}
	/** @param {unknown} error @returns {boolean} */
	is_retryable_io_error(error) {
		return typeof error === "object" && error !== null && "code" in error && error.code === "EAGAIN";
	}
	/** @returns {{ text: string; length: number } | null} */
	response_header() {
		let text = "";
		for (const chunk of this.response_chunks) {
			const end = chunk.indexOf(10);
			if (end >= 0) {
				return { text: text + chunk.toString("ascii", 0, end), length: text.length + end };
			}
			text += chunk.toString("ascii");
		}
		return null;
	}
	/** @returns {string} */
	read_frame() {
		const deadline = performance.now() + this.io_timeout_ms;
		let header = this.response_header();
		while (header === null) {
			this.append_response_bytes(deadline);
			header = this.response_header();
		}
		const payload_length = Number(header.text);
		const frame_length = header.length + 1 + payload_length + 1;
		while (this.response_length < frame_length) {
			this.append_response_bytes(deadline);
		}
		const frame = Buffer.concat(this.response_chunks, this.response_length);
		if (frame[frame_length - 1] !== 10) {
			throw this.worker_error("Python AST worker returned an invalid response delimiter.");
		}
		const payload_start = header.length + 1;
		const payload = frame.toString("utf8", payload_start, payload_start + payload_length);
		const remainder = frame.subarray(frame_length);
		this.response_chunks = remainder.length === 0 ? [] : [remainder];
		this.response_length = remainder.length;
		return payload;
	}
	/** @param {string} payload */
	write_frame(payload) {
		const input_fd = this.input_fd;
		if (input_fd === null) {
			throw new Error("Python AST worker input pipe is closed.");
		}
		const payload_buffer = Buffer.from(payload, "utf8");
		const frame = Buffer.concat([Buffer.from(`${String(payload_buffer.length)}\n`), payload_buffer, Buffer.from("\n")]);
		let offset = 0;
		const deadline = performance.now() + this.io_timeout_ms;
		while (offset < frame.length) {
			try {
				offset += writeSync(input_fd, frame, offset, frame.length - offset);
			} catch (error) {
				if (!this.is_retryable_io_error(error)) {
					throw error;
				}
				try {
					this.read_response_bytes();
				} catch (read_error) {
					if (!this.is_retryable_io_error(read_error)) {
						throw read_error;
					}
					this.wait_for_io(deadline, "Python AST worker request timed out.");
				}
			}
		}
	}
	/** @returns {void} */
	close() {
		this.input_fd = null;
		this.output_fd = null;
		this.response_chunks = [];
		this.response_length = 0;
	}
}
