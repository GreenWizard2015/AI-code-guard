#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AgentHookApplication } from "src/core/support/task/review-agent/agent_hook_application";
import { REVIEW_PHASE_ARGUMENT, REVIEW_PREFIX_ARGUMENT } from "src/core/support/task/review-agent/constants";
import { HookPayloadNormalizer } from "src/core/support/task/review-agent/hook_payload_normalizer";
import type { RawHookPayload } from "src/core/support/task/review-agent/types";
import { NodeFileIO } from "src/io/node_file_io";

if (process.argv.length > 1) {
	const SCRIPT = process.argv[1];
	if (resolve(SCRIPT) === fileURLToPath(import.meta.url)) {
		(() => {
			try {
				const application = new AgentHookApplication(new NodeFileIO());
				const raw_payload: RawHookPayload = JSON.parse(readFileSync(0, "utf8"));
				let review_prefix = "";
				if (typeof raw_payload.review_prefix === "string") {
					review_prefix = raw_payload.review_prefix;
				}
				const review_prefix_index = process.argv.indexOf(REVIEW_PREFIX_ARGUMENT);
				if (review_prefix_index >= 0) {
					const argument = process.argv[review_prefix_index + 1];
					if (argument !== undefined) {
						review_prefix = argument;
					}
				}
				let review_phase = "initial";
				const review_phase_index = process.argv.indexOf(REVIEW_PHASE_ARGUMENT);
				if (review_phase_index >= 0 && process.argv[review_phase_index + 1] === "cleanup") {
					review_phase = "cleanup";
				}
				const normalizer = new HookPayloadNormalizer(review_prefix, review_phase);
				const payload = normalizer.normalize(raw_payload);
				const decision = application.decision(payload);
				const output = application.response(payload, decision);
				if (output !== "") {
					process.stdout.write(output);
					return;
				}
				process.stdout.write(JSON.stringify(decision));
			} catch (error) {
				process.exitCode = 2;
				process.stderr.write(`Review hook failed: ${String(error)}\n`);
			}
		})();
	}
}
