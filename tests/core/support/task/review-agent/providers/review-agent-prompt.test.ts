import { describe, expect, test } from "@jest/globals";
import { ReviewAgentCatalog } from "src/core/support/task/review-agent/providers/review_agent_catalog";
import { NodeFileIO } from "src/io/node_file_io";
import {
	CATALOG_REVIEW_REQUEST,
	CLEANUP_REVIEW_REQUEST,
} from "tests/core/support/task/review-agent/providers/constants";

describe("review prompt construction", () => {
	test("includes the instruction and output paths", () => {
		const runner = new ReviewAgentCatalog([], new NodeFileIO(process.cwd()));
		const prompt = runner.prompt({ prompt_request: CATALOG_REVIEW_REQUEST });

		expect({
			instruction: prompt.includes("You are an independent architecture-review agent."),
			preamble: prompt.includes("Working directory: /project") && prompt.includes("review-boundaries-"),
			unrendered_prefix: prompt.includes("{{REVIEW_PREFIX}}"),
			review_path: prompt.includes("/project/.ai-code-guard/review"),
		}).toEqual({
			instruction: true,
			preamble: true,
			unrendered_prefix: false,
			review_path: true,
		});
	});

	test("passes existing open findings as exclusions", () => {
		const runner = new ReviewAgentCatalog([], new NodeFileIO(process.cwd()));
		const request = {
			...CATALOG_REVIEW_REQUEST,
			review_stage: "tests",
			review_stage_plan: "tests: review-tests-",
			hook: { ...CATALOG_REVIEW_REQUEST.hook, review_prefix: "review-tests-" },
			open_review_files: ["/project/.ai-code-guard/review/review-tests-known-finding.md"],
		};
		const prompt = runner.prompt({ prompt_request: request });

		expect({
			prior_finding: prompt.includes("/project/.ai-code-guard/review/review-tests-known-finding.md"),
			exclusion_instruction: prompt.includes("Do not report the same defects"),
		}).toEqual({ prior_finding: true, exclusion_instruction: true });
	});

	test("includes every open review file in the cleanup prompt", () => {
		const runner = new ReviewAgentCatalog([], new NodeFileIO(process.cwd()));
		const prompt = runner.cleanup_prompt({ cleanup_request: CLEANUP_REVIEW_REQUEST });
		const all_stage_instructions = [
			"repeated parsing",
			"missing failure-path coverage",
			"domain object",
			"state transitions",
		].every((instruction) => prompt.includes(instruction));

		expect({
			first: prompt.includes("- /project/.ai-code-guard/review/first.md"),
			second: prompt.includes("- /project/.ai-code-guard/review/second.md"),
			all_stage_instructions,
		}).toEqual({ first: true, second: true, all_stage_instructions: true });
	});
});
