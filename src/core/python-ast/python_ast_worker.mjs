// @ts-check
import { spawn, spawnSync } from "node:child_process";
import { closeSync, mkdtempSync, openSync, readFileSync, rmdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PythonAstWorkerTransport } from "../python-ast-worker-transport.mjs";

/**
 * @typedef {import("src/core/python-ast/types").PythonAstWorkerOptions} PythonAstWorkerOptions
 * @typedef {import("src/core/python-ast/types").PythonAstWorkerResponse} PythonAstWorkerResponse
 * @typedef {import("src/python_protocols").PythonAstWorkerContract} PythonAstWorkerContract
 */
/** Responsibilities: _Python source batch processing_, _worker process lifetime_. **/
/** @implements {PythonAstWorkerContract} */
export class PythonAstWorker {
	/** @param {PythonAstWorkerOptions} options */
	constructor({ arguments_list, options, persistent, io_timeout_ms }) {
		/** @type {string[]} */
		this.arguments_list = arguments_list;
		/** @type {import("node:child_process").SpawnOptions} */
		this.options = options;
		/** @type {boolean} */
		this.persistent = persistent;
		/** @type {number} */
		this.io_timeout_ms = io_timeout_ms;
		/** @type {PythonAstWorkerTransport} */
		this.transport = new PythonAstWorkerTransport(io_timeout_ms);
		/** @type {import("node:child_process").ChildProcess | null} */
		this.child = null;
		/** @type {string | null} */
		this.stderr_directory = null;
		/** @type {string | null} */
		this.stderr_path = null;
		/** @type {number | null} */
		this.stderr_fd = null;
		/** @type {Promise<void>} */
		this.exit_promise = Promise.resolve();
		/** @type {boolean} */
		this.exit_observed = false;
		/** @type {string[]} */
		this.pending_batch_ids = [];
		/** @type {Map<string, PythonAstWorkerResponse>} */
		this.completed_batches = new Map();
		if (!persistent) {
			return;
		}
	}
	/** @returns {void} */
	start_persistent() {
		if (!this.persistent || this.child !== null) {
			return;
		}
		this.stderr_directory = mkdtempSync(join(tmpdir(), "ai-code-guard-python-worker-"));
		this.stderr_path = join(this.stderr_directory, "stderr.log");
		this.stderr_fd = openSync(this.stderr_path, "w+");
		/** @type {import("node:child_process").SpawnOptions} */
		const options = { ...this.options, stdio: ["pipe", "pipe", this.stderr_fd] };
		const child = spawn("python3", this.arguments_list, options);
		this.child = child;
		this.exit_observed = false;
		this.exit_promise = new Promise((resolve) => {
			/** @returns {void} */
			const settle_exit = () => {
				this.exit_observed = true;
				resolve();
			};
			child.once("error", () => {
				if (child.pid === undefined) {
					settle_exit();
				}
			});
			child.once("exit", settle_exit);
		});
		if (child.pid === undefined) {
			throw new Error("Python AST worker process did not start.");
		}
		this.transport.attach(child, (message) => this.worker_error(message));
	}
	/** @returns {number} */
	worker_id() {
		return this.child?.pid ?? -1;
	}
	/** @returns {Promise<void>} */
	wait_for_exit() {
		return this.exit_promise;
	}
	/** @returns {boolean} */
	has_exited() {
		return this.exit_observed;
	}
	/** @param {string} message @returns {Error} */
	worker_error(message) {
		const stderr = this.stderr_path === null ? "" : readFileSync(this.stderr_path, "utf8").slice(-8192).trim();
		if (stderr.length === 0) {
			return new Error(message);
		}
		return new Error(`${message} Python AST worker stderr: ${stderr}`);
	}
	/** @returns {string} */
	read_response() {
		return this.transport.read_frame();
	}
	/** @param {string} payload @returns {void} */
	write_frame(payload) {
		this.transport.write_frame(payload);
	}
	/** @param {string} batch_id @param {Map<string, string>} sources @returns {PythonAstWorkerResponse} */
	batch_result(batch_id, sources) {
		const request = JSON.stringify({ batch_id, sources: Object.fromEntries(sources) });
		try {
			this.start_persistent();
			if (this.child === null) {
				return this.single_batch_result(request);
			}
			this.write_frame(request);
			this.pending_batch_ids.push(batch_id);
			return this.read_batch_response(batch_id);
		} catch (error) {
			this.cleanup_resources();
			throw error;
		}
	}
	/** @param {string} batch_id @param {Map<string, string>} sources @returns {import("src/python_protocols").PythonAstWorkerBatchContract} */
	batch(batch_id, sources) {
		const worker = this;
		return {
			result() {
				return worker.batch_result(batch_id, sources);
			},
			start() {
				worker.start_batch(batch_id, sources);
			},
			complete() {
				return worker.complete_batch(batch_id);
			},
			cancel() {
				worker.cancel_batch(batch_id);
			},
		};
	}
	/** @param {string} batch_id @param {Map<string, string>} sources @returns {void} */
	start_batch(batch_id, sources) {
		try {
			this.start_persistent();
			if (this.child === null) {
				throw new Error("Concurrent Python AST batches require a persistent worker.");
			}
			this.write_frame(JSON.stringify({ batch_id, sources: Object.fromEntries(sources) }));
			this.pending_batch_ids.push(batch_id);
		} catch (error) {
			this.cleanup_resources();
			throw error;
		}
	}
	/** @param {string} batch_id @returns {PythonAstWorkerResponse} */
	complete_batch(batch_id) {
		if (this.child === null) {
			throw new Error("Concurrent Python AST batch was not started.");
		}
		try {
			const expected_batch_id = batch_id ?? this.pending_batch_ids[0];
			if (expected_batch_id === undefined) {
				throw new Error("Concurrent Python AST batch was not started.");
			}
			return this.read_batch_response(expected_batch_id);
		} catch (error) {
			this.cleanup_resources();
			throw error;
		}
	}
	/** @param {string} batch_id @returns {void} */
	cancel_batch(batch_id) {
		this.complete_batch(batch_id);
	}
	/** @param {string} payload @returns {PythonAstWorkerResponse} */
	parse_response(payload) {
		const response = JSON.parse(payload);
		return { ...response, asts: new Map(Object.entries(response.asts)) };
	}
	/** @param {string} batch_id @returns {PythonAstWorkerResponse} */
	read_batch_response(batch_id) {
		const completed = this.completed_batches.get(batch_id);
		if (completed !== undefined) {
			this.completed_batches.delete(batch_id);
			return completed;
		}
		while (true) {
			const response = this.parse_response(this.read_response());
			const response_index = this.pending_batch_ids.indexOf(response.batch_id);
			if (response_index < 0) {
				return response;
			}
			this.pending_batch_ids.splice(response_index, 1);
			if (response.batch_id === batch_id) {
				return response;
			}
			this.completed_batches.set(response.batch_id, response);
		}
	}
	/** @param {string} request @returns {PythonAstWorkerResponse} */
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
	/** @returns {void} */
	cleanup_resources() {
		const child = this.child;
		this.pending_batch_ids = [];
		this.completed_batches.clear();
		this.transport.close();
		if (child !== null) {
			this.cleanup_child(child);
		}
		this.cleanup_stderr_descriptor();
		this.cleanup_stderr_file();
		this.cleanup_stderr_directory();
	}
	/** @param {import("node:child_process").ChildProcess} child @returns {void} */
	cleanup_child(child) {
		try {
			if (child.stdin !== null) {
				child.stdin.destroy();
			}
			if (child.stdout !== null) {
				child.stdout.destroy();
			}
			if (child.stderr !== null) {
				child.stderr.destroy();
			}
			if (child.exitCode === null) {
				child.kill("SIGCONT");
				child.kill("SIGKILL");
			}
		} catch {
			// Preserve the original failure while cleanup remains best-effort.
		}
		this.child = null;
	}
	/** @returns {void} */
	cleanup_stderr_descriptor() {
		if (this.stderr_fd === null) {
			return;
		}
		try {
			closeSync(this.stderr_fd);
		} catch {
			// Preserve the original failure while cleanup remains best-effort.
		}
		this.stderr_fd = null;
	}
	/** @returns {void} */
	cleanup_stderr_file() {
		if (this.stderr_path === null) {
			return;
		}
		try {
			unlinkSync(this.stderr_path);
		} catch {
			// Preserve the original failure while cleanup remains best-effort.
		}
		this.stderr_path = null;
	}
	/** @returns {void} */
	cleanup_stderr_directory() {
		if (this.stderr_directory === null) {
			return;
		}
		try {
			rmdirSync(this.stderr_directory);
		} catch {
			// Preserve the original failure while cleanup remains best-effort.
		}
		this.stderr_directory = null;
	}
	/** @returns {void} */
	close() {
		try {
			if (this.child === null) {
				return;
			}
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
