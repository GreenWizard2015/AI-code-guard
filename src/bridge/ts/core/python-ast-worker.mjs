import { spawn, spawnSync } from 'node:child_process';
import { readSync, writeSync } from 'node:fs';

export class PythonAstWorker {
	constructor(arguments_list, options, persistent) {
		this.arguments_list = arguments_list;
		this.options = options;
		if (!persistent) {
			this.child = null;
			return;
		}
		this.child = spawn('python3', arguments_list, options);
		const input = this.child.stdin;
		const output = this.child.stdout;
		if (input === null || output === null) {
			throw new Error('Python AST worker pipes were not created.');
		}
		this.input_fd = input._handle.fd;
		this.output_fd = output._handle.fd;
		this.response_buffer = Buffer.alloc(0);
		this.wait_buffer = new Int32Array(new SharedArrayBuffer(4));
		this.child.unref();
		input.unref();
		output.unref();
		if (this.child.stderr !== null) {
			this.child.stderr.unref();
		}
	}

	append_response_bytes() {
		const buffer = Buffer.alloc(64 * 1024);
		while (true) {
			try {
				const count = readSync(this.output_fd, buffer, 0, buffer.length, null);
				if (count === 0) {
					throw new Error('Python AST worker exited before returning a response.');
				}
				this.response_buffer = Buffer.concat([this.response_buffer, buffer.subarray(0, count)]);
				return;
			} catch (error) {
				if (!String(error).includes('EAGAIN')) {
					throw error;
				}
				Atomics.wait(this.wait_buffer, 0, 0, 2);
			}
		}
	}

	read_response() {
		let header_end = this.response_buffer.indexOf(10);
		while (header_end < 0) {
			this.append_response_bytes();
			header_end = this.response_buffer.indexOf(10);
		}
		const payload_length = Number(this.response_buffer.subarray(0, header_end).toString('ascii'));
		const payload_start = header_end + 1;
		const frame_end = payload_start + payload_length + 1;
		while (this.response_buffer.length < frame_end) {
			this.append_response_bytes();
		}
		const payload = this.response_buffer.subarray(payload_start, frame_end - 1);
		this.response_buffer = this.response_buffer.subarray(frame_end);
		return payload.toString('utf8');
	}

	write_frame(payload) {
		const payload_buffer = Buffer.from(payload, 'utf8');
		const frame = Buffer.concat([
			Buffer.from(`${String(payload_buffer.length)}\n`),
			payload_buffer,
			Buffer.from('\n'),
		]);
		let offset = 0;
		while (offset < frame.length) {
			try {
				offset += writeSync(this.input_fd, frame, offset, frame.length - offset);
			} catch (error) {
				if (!String(error).includes('EAGAIN')) {
					throw error;
				}
				Atomics.wait(this.wait_buffer, 0, 0, 2);
			}
		}
	}

	batch_result(batch_id, sources) {
		const request = JSON.stringify({ batchId: batch_id, sources });
		if (this.child === null) {
			return this.single_batch_result(request);
		}
		this.write_frame(request);
		return JSON.parse(this.read_response());
	}

	single_batch_result(request) {
		const payload = Buffer.from(request, 'utf8');
		const frame = Buffer.concat([
			Buffer.from(`${String(payload.length)}\n`),
			payload,
			Buffer.from('\n'),
		]);
		const result = spawnSync('python3', this.arguments_list, {
			...this.options,
			input: frame,
			encoding: 'buffer',
			maxBuffer: 64 * 1024 * 1024,
		});
		if (result.error !== undefined) {
			throw result.error;
		}
		if (result.status !== 0) {
			throw new Error(`Python AST bridge failed with exit status ${String(result.status)}.`);
		}
		this.response_buffer = Buffer.from(result.stdout);
		return JSON.parse(this.read_response());
	}

	close() {
		if (this.child === null) {
			return;
		}
		this.write_frame(JSON.stringify({ command: 'exit' }));
		this.child.kill();
	}
}
