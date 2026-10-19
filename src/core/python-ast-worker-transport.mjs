import { readSync, writeSync } from "node:fs";
import { performance } from "node:perf_hooks";

export class PythonAstWorkerTransport {
	constructor(io_timeout_ms = 10000) {
		this.io_timeout_ms = io_timeout_ms;
		this.input_fd = null;
		this.output_fd = null;
		this.response_chunks = [];
		this.response_length = 0;
		this.wait_buffer = new Int32Array(new SharedArrayBuffer(4));
		this.worker_error = (message) => new Error(message);
	}

	attach(child, worker_error) {
		const input = child.stdin;
		const output = child.stdout;
		if (input === null || input === undefined || output === null || output === undefined) {
			throw new Error("Python AST worker pipes were not created.");
		}
		const input_fd = input._handle?.fd;
		const output_fd = output._handle?.fd;
		if (!Number.isInteger(input_fd) || !Number.isInteger(output_fd)) {
			throw new Error("Python AST worker requires native Node child-process pipes.");
		}
		this.input_fd = input_fd;
		this.output_fd = output_fd;
		this.worker_error = worker_error;
		child.unref();
		input.unref();
		output.unref();
	}

	set_response(frame) {
		this.response_chunks = [Buffer.from(frame)];
		this.response_length = this.response_chunks[0].length;
	}

	wait_for_io(deadline, message) {
		const remaining = deadline - performance.now();
		if (remaining <= 0) throw this.worker_error(message);
		Atomics.wait(this.wait_buffer, 0, 0, Math.min(2, remaining));
	}

	append_response_bytes(deadline) {
		const buffer = Buffer.alloc(64 * 1024);
		while (true) {
			try {
				const count = readSync(this.output_fd, buffer, 0, buffer.length, null);
				if (count === 0) throw this.worker_error("Python AST worker exited before returning a response.");
				this.response_chunks.push(buffer.subarray(0, count));
				this.response_length += count;
				return;
			} catch (error) {
				if (!String(error).includes("EAGAIN")) throw error;
				this.wait_for_io(deadline, "Python AST worker response timed out.");
			}
		}
	}

	response_header() {
		let text = "";
		for (const chunk of this.response_chunks) {
			const end = chunk.indexOf(10);
			if (end >= 0) return { text: text + chunk.toString("ascii", 0, end), length: text.length + end };
			text += chunk.toString("ascii");
		}
		return null;
	}

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

	write_frame(payload) {
		const payload_buffer = Buffer.from(payload, "utf8");
		const frame = Buffer.concat([Buffer.from(`${String(payload_buffer.length)}\n`), payload_buffer, Buffer.from("\n")]);
		let offset = 0;
		const deadline = performance.now() + this.io_timeout_ms;
		while (offset < frame.length) {
			try {
				offset += writeSync(this.input_fd, frame, offset, frame.length - offset);
			} catch (error) {
				if (!String(error).includes("EAGAIN")) throw error;
				this.wait_for_io(deadline, "Python AST worker request timed out.");
			}
		}
	}

	close() {
		this.input_fd = null;
		this.output_fd = null;
		this.response_chunks = [];
		this.response_length = 0;
	}
}
