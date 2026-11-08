import type { ReviewAgentRequest } from "src/task_review_types";
import { REVIEW_PROMPT } from "tests/bridge/ts/core/constants";

export const REVIEW_REQUEST: ReviewAgentRequest = {
	root: "/project",
	instruction: "DIRECT REVIEW INSTRUCTION",
	review_root: "/project/.ai-code-guard/review",
	hook: {
		hook_file: "/project/.ai-code-guard/agent-hooks.ts",
		hook_command: "/tools/tsx",
		review_prefix: "review-boundaries-",
		review_start_ms: 0,
	},
	review_stage: "boundaries",
	review_stage_plan: "boundaries: review-boundaries-",
	open_review_files: [],
	prompt: REVIEW_PROMPT,
};

export const CATALOG_REVIEW_REQUEST: ReviewAgentRequest = { ...REVIEW_REQUEST, prompt: "" };
