import { performance } from "node:perf_hooks";
import { MessageChannel, receiveMessageOnPort } from "node:worker_threads";
import { describe, expect, test } from "@jest/globals";
import { TYPESCRIPT_CACHE_OWNER } from "src/constants";
import { TypeScriptWorkerEntry } from "src/linting/orchestration/runtime/file_linting/typescript_worker/type_script_worker_entry";
import type { TypeScriptWorkerInput } from "src/typescript_file_worker_types";

describe("TypeScript AST worker", () => {
	test("parses only the source text assigned to its shard", () => {
		const channel = new MessageChannel();
		const input: TypeScriptWorkerInput = {
			files: ["/virtual/project/first.ts", "/virtual/project/second.ts"],
			control: new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT),
			port: channel.port1,
			typescript_module_name: TYPESCRIPT_CACHE_OWNER,
			snapshot: {
				enqueued_at_ms: performance.timeOrigin + performance.now(),
				sources: [
					{ file: "/virtual/project/first.ts", text: "export const first = 1;" },
					{ file: "/virtual/project/second.ts", text: "export const second = 2;" },
				],
			},
		};

		const entry = new TypeScriptWorkerEntry(input);
		entry.run();
		const result = receiveMessageOnPort(channel.port2);
		let output: unknown;
		if (result !== undefined) {
			output = result.message;
		}
		channel.port1.close();
		channel.port2.close();
		expect(output).toMatchObject({
			ok: true,
			parsed_files: 2,
			violations: [],
			timers: [
				{ name: "typescript.worker.shard./virtual/project/first.ts.queue", duration_ms: expect.any(Number) },
				{ name: "typescript.worker.shard./virtual/project/first.ts.parse", duration_ms: expect.any(Number) },
				{ name: "typescript.worker.shard./virtual/project/first.ts.completion", duration_ms: expect.any(Number) },
			],
			error: "",
			stack: "",
		});
	});

	test("accepts an empty parse shard", () => {
		const channel = new MessageChannel();
		const input: TypeScriptWorkerInput = {
			files: [],
			control: new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT),
			port: channel.port1,
			typescript_module_name: TYPESCRIPT_CACHE_OWNER,
			snapshot: { sources: [], enqueued_at_ms: performance.timeOrigin + performance.now() },
		};

		const entry = new TypeScriptWorkerEntry(input);
		entry.run();
		const result = receiveMessageOnPort(channel.port2);
		let output: unknown;
		if (result !== undefined) {
			output = result.message;
		}
		channel.port1.close();
		channel.port2.close();
		expect(output).toMatchObject({
			ok: true,
			parsed_files: 0,
			violations: [],
			timers: [
				{ name: "typescript.worker.shard.empty.queue", duration_ms: expect.any(Number) },
				{ name: "typescript.worker.shard.empty.parse", duration_ms: expect.any(Number) },
				{ name: "typescript.worker.shard.empty.completion", duration_ms: expect.any(Number) },
			],
			error: "",
			stack: "",
		});
	});
});
