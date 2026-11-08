#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BoundaryFailureCategory } from "src/analysis_protocols";
import { REPORTING_PROJECT_ROOT } from "src/constants";
import { AgentHookApplication } from "src/core/support/task/review-agent/agent_hook_application";
import { REVIEW_PREFIX_ARGUMENT, REVIEW_STARTED_AT_ARGUMENT } from "src/core/support/task/review-agent/constants";
import { HookPayloadNormalizer } from "src/core/support/task/review-agent/hook_payload_normalizer";
import type { RawHookPayload } from "src/core/support/task/review-agent/types";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";
import { SYSTEM_FAILURE_CODES } from "src/io/constants";
import { NodeFileIO } from "src/io/node_file_io";

if (process.argv.length > 1) {
	const SCRIPT = process.argv[1];
	if (SCRIPT !== undefined && resolve(SCRIPT) === fileURLToPath(import.meta.url)) {
		(() => {
			const boundary_failures = new BoundaryFailureClassifier(SYSTEM_FAILURE_CODES);
			try {
				const application = new AgentHookApplication(new NodeFileIO(process.cwd()), REPORTING_PROJECT_ROOT);
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
				let review_start_ms = Number.POSITIVE_INFINITY;
				const timestamp_index = process.argv.indexOf(REVIEW_STARTED_AT_ARGUMENT);
				if (timestamp_index >= 0) {
					const argument = process.argv[timestamp_index + 1];
					if (argument !== undefined && Number.isFinite(Number(argument))) {
						review_start_ms = Number(argument);
					}
				}
				const normalizer = new HookPayloadNormalizer(review_prefix, review_start_ms);
				const payload = normalizer.normalize(raw_payload);
				const decision = application.decision(payload);
				const output = application.response({ payload, decision });
				if (output !== "") {
					process.stdout.write(output);
					return;
				}
				process.stdout.write(JSON.stringify(decision));
			} catch (error) {
				if (!boundary_failures.check(String(error), BoundaryFailureCategory.CacheRead)) {
					throw error;
				}
				process.stderr.write(`Review hook failed: ${String(error)}\n`);
				process.exit(2);
			}
		})();
	}
}
