import { spawn, spawnSync } from "node:child_process";
import { closeSync, mkdtempSync, openSync, readFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PythonAstWorkerTransport } from "./python-ast-worker-transport.mjs";

const DEFAULT_IO_TIMEOUT_MS = 10000;

export class PythonAstWorker {
	constructor(
		arguments_list,
		options,
		persistent,
		io_timeout_ms = DEFAULT_IO_TIMEOUT_MS,
		spawn_process = spawn,
		transport = new PythonAstWorkerTransport(io_timeout_ms),
	) {
		this.arguments_list = arguments_list;
		this.options = options;
		this.persistent = persistent;
		this.io_timeout_ms = io_timeout_ms;
		this.spawn_process = spawn_process;
		this.transport = transport;
		this.child = null;
		this.stderr_directory = null;
		this.stderr_path = null;
		this.stderr_fd = null;
		this.exit_promise = Promise.resolve();
		this.exit_observed = false;
		if (!persistent) return;
	}

	start_persistent() {
		if (!this.persistent || this.child !== null) return;
		this.stderr_directory = mkdtempSync(join(tmpdir(), "ai-code-guard-python-worker-"));
		this.stderr_path = join(this.stderr_directory, "stderr.log");
		this.stderr_fd = openSync(this.stderr_path, "w+");
		const options = { ...this.options, stdio: ["pipe", "pipe", this.stderr_fd] };
		this.child = this.spawn_process("python3", this.arguments_list, options);
		const child = this.child;
		this.exit_observed = false;
		this.exit_promise = new Promise((resolve) => {
			const settle_exit = () => {
				this.exit_observed = true;
				resolve();
			};
			child.once("error", () => {
				if (child.pid === undefined) settle_exit();
			});
			child.once("exit", settle_exit);
		});
		if (child.pid === undefined) {
			throw new Error("Python AST worker process did not start.");
		}
		this.transport.attach(child, (message) => this.worker_error(message));
	}

	is_active() {
		return this.child !== null;
	}

	process_id() {
		return this.child?.pid ?? -1;
	}

	wait_for_exit() {
		return this.exit_promise;
	}

	process_exited() {
		return this.exit_observed;
	}

	worker_error(message) {
		const stderr = this.stderr_path === null ? "" : readFileSync(this.stderr_path, "utf8").slice(-8192).trim();
		if (stderr.length === 0) {
			return new Error(message);
		}
		return new Error(`${message} Python AST worker stderr: ${stderr}`);
	}

	read_response() {
		return this.transport.read_frame();
	}

	write_frame(payload) {
		this.transport.write_frame(payload);
	}

	batch_result(batch_id, sources) {
		const request = JSON.stringify({ batchId: batch_id, sources });
		try {
			this.start_persistent();
			if (this.child === null) {
				return this.single_batch_result(request);
			}
			this.write_frame(request);
			return this.parse_response(this.read_response());
		} catch (error) {
			this.cleanup_resources();
			throw error;
		}
	}

	batch_error(batch_id, sources) {
		try {
			this.batch_result(batch_id, sources);
			return "";
		} catch (error) {
			return String(error);
		}
	}

	start_batch(batch_id, sources) {
		try {
			this.start_persistent();
			if (this.child === null) {
				throw new Error("Concurrent Python AST batches require a persistent worker.");
			}
			this.write_frame(JSON.stringify({ batchId: batch_id, sources }));
		} catch (error) {
			this.cleanup_resources();
			throw error;
		}
	}

	complete_batch() {
		if (this.child === null) {
			throw new Error("Concurrent Python AST batch was not started.");
		}
		try {
			return this.parse_response(this.read_response());
		} catch (error) {
			this.cleanup_resources();
			throw error;
		}
	}

	parse_response(payload) {
		const response = JSON.parse(payload);
		return { ...response, asts: new Map(Object.entries(response.asts)) };
	}

	single_batch_result(request) {
		const payload = Buffer.from(request, "utf8");
		const frame = Buffer.concat([Buffer.from(`${String(payload.length)}\n`), payload, Buffer.from("\n")]);
		const result = spawnSync("python3", this.arguments_list, {
			...this.options,
			input: frame,
			encoding: "buffer",
			maxBuffer: 64 * 1024 * 1024,
			timeout: this.io_timeout_ms,
			killSignal: "SIGKILL",
		});
		const stderr = Buffer.isBuffer(result.stderr)
			? result.stderr.toString("utf8").slice(-8192).trim()
			: String(result.stderr ?? "")
					.slice(-8192)
					.trim();
		const details = [`exit status ${String(result.status)}`];
		if (result.signal !== null) {
			details.push(`signal ${result.signal}`);
		}
		if (result.error !== undefined) {
			details.push(String(result.error));
		}
		if (stderr.length > 0) {
			details.push(`stderr: ${stderr}`);
		}
		if (result.error !== undefined || result.status !== 0) {
			throw new Error(`Python AST bridge failed: ${details.join("; ")}.`);
		}
		this.transport.set_response(result.stdout);
		return this.parse_response(this.read_response());
	}

	cleanup_resources() {
		const child = this.child;
		this.transport.close();
		if (child !== null) {
			try {
				if (child.stdin !== null) child.stdin.destroy();
				if (child.stdout !== null) child.stdout.destroy();
				if (child.stderr !== null) child.stderr.destroy();
				if (child.exitCode === null) {
					child.kill("SIGCONT");
					child.kill("SIGKILL");
				}
			} catch (error) {
				void error;
			}
			this.child = null;
		}
		if (this.stderr_fd !== null) {
			try {
				closeSync(this.stderr_fd);
			} catch (error) {
				void error;
			}
			this.stderr_fd = null;
		}
		if (this.stderr_path !== null) {
			try {
				unlinkSync(this.stderr_path);
			} catch (error) {
				void error;
			}
			this.stderr_path = null;
		}
		if (this.stderr_directory !== null) {
			try {
				rmdirSync(this.stderr_directory);
			} catch (error) {
				void error;
			}
			this.stderr_directory = null;
		}
	}

	close() {
		try {
			if (this.child === null) return;
			this.write_frame(JSON.stringify({ command: "exit" }));
			const response = JSON.parse(this.read_response());
			if (response.status !== "exited") {
				throw new Error("Python AST worker did not acknowledge exit.");
			}
		} catch (error) {
			if (!String(error).includes("EPIPE")) {
				throw error;
			}
		} finally {
			this.cleanup_resources();
		}
	}
}
