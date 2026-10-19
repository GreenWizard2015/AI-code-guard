import { describe, expect, test } from "@jest/globals";
import { ClaudeReviewAgent } from "src/core/support/task/review-agent/providers/claude_review_agent";
import { CodexReviewAgent } from "src/core/support/task/review-agent/providers/codex_review_agent";
import { ReviewAgentCatalog } from "src/core/support/task/review-agent/providers/review_agent_catalog";
import { NodeFileIO } from "src/io/node_file_io";
import type { ReviewAgentRequest } from "src/types";
import { METACHARACTER_REQUEST, REVIEW_PROMPT } from "tests/bridge/ts/core/constants";
import { RecordingProcess } from "tests/bridge/ts/core/recording-review-process";
import { StubReviewAgent } from "tests/bridge/ts/core/review-agent/stub-review-agent";

describe("review-agent runner", () => {
	test("builds a hook-controlled Codex command with the project paths", async () => {
		const process = new RecordingProcess();
		const agent = new CodexReviewAgent(process);
		const request: ReviewAgentRequest = {
			root: "/project",
			instruction: "DIRECT REVIEW INSTRUCTION",
			review_root: "/project/.ai-code-guard/review",
			hook: {
				hook_file: "/project/.ai-code-guard/agent-hooks.ts",
				hook_command: "/tools/tsx",
				review_prefix: "review-boundaries-",
				review_phase: "initial",
			},
			review_stage: "boundaries",
			review_stage_plan: "boundaries: review-boundaries-",
			open_review_files: [],
			prompt: REVIEW_PROMPT,
		};
		await agent.run_async(request);
		const hook_argument_index = process.arguments_list.indexOf("-c");
		let hook_configuration = "";
		const configured_hook = process.arguments_list[hook_argument_index + 1];
		if (configured_hook !== undefined) {
			hook_configuration = configured_hook;
		}
		expect({
			command: process.command,
			root: process.root,
			arguments: process.arguments_list.slice(0, 11),
			hooks_configured: hook_configuration.includes("PreToolUse"),
			pre_tool_use_matches_all_tools: hook_configuration.includes('PreToolUse=[{matcher=".*"'),
			prefix_configured:
				hook_configuration.includes("--review-prefix") && hook_configuration.includes("review-boundaries-"),
			phase_configured: hook_configuration.includes("--review-phase") && hook_configuration.includes("initial"),
		}).toEqual({
			command: "codex",
			root: "/project",
			arguments: [
				"exec",
				"--json",
				"--ignore-user-config",
				"--cd",
				"/project",
				"--sandbox",
				"danger-full-access",
				"--add-dir",
				"/project/.ai-code-guard/review",
				"--skip-git-repo-check",
				"-c",
			],
			hooks_configured: true,
			pre_tool_use_matches_all_tools: true,
			prefix_configured: true,
			phase_configured: true,
		});
		expect(process.arguments_list[12]).toBe(REVIEW_PROMPT);
	});

	test("builds a Claude command with review-only tools", async () => {
		const process = new RecordingProcess();
		const agent = new ClaudeReviewAgent(process);
		const request: ReviewAgentRequest = {
			root: "/project",
			instruction: "DIRECT REVIEW INSTRUCTION",
			review_root: "/project/.ai-code-guard/review",
			hook: {
				hook_file: "/project/.ai-code-guard/agent-hooks.ts",
				hook_command: "/tools/tsx",
				review_prefix: "review-boundaries-",
				review_phase: "initial",
			},
			review_stage: "boundaries",
			review_stage_plan: "boundaries: review-boundaries-",
			open_review_files: [],
			prompt: REVIEW_PROMPT,
		};
		await agent.run_async(request);
		const settings_argument = process.arguments_list[10];
		let settings_configured = false;
		let pre_tool_use_matches_all_tools = false;
		if (settings_argument !== undefined) {
			settings_configured = settings_argument.includes("PreToolUse");
			pre_tool_use_matches_all_tools = settings_argument.includes('"matcher":".*"');
		}
		expect({
			command: process.command,
			arguments: process.arguments_list.slice(0, 10),
			settings_configured: process.arguments_list.includes("--settings") && settings_configured,
			pre_tool_use_matches_all_tools,
		}).toEqual({
			command: "claude",
			arguments: [
				"--print",
				"--output-format",
				"json",
				"--add-dir",
				"/project/.ai-code-guard/review",
				"--allowed-tools",
				"Read,Write,Bash",
				"--disallowed-tools",
				"Edit,NotebookEdit",
				"--settings",
			],
			settings_configured: true,
			pre_tool_use_matches_all_tools: true,
		});
		expect(process.arguments_list[11]).toBe(REVIEW_PROMPT);
	});

	test("keeps shell metacharacters literal in the Codex hook command", async () => {
		const codex_process = new RecordingProcess();
		const codex_agent = new CodexReviewAgent(codex_process);
		await codex_agent.run_async(METACHARACTER_REQUEST);
		const codex_configuration_index = codex_process.arguments_list.indexOf("-c") + 1;
		let codex_configuration = "";
		const configured_codex = codex_process.arguments_list[codex_configuration_index];
		if (configured_codex !== undefined) {
			codex_configuration = configured_codex;
		}
		const expected_file = "agent'\\\"'\\\"'s-hooks.ts";
		const expected_prefix = "'review-$(touch injected)-'";

		expect({
			codex_file: codex_configuration.includes(expected_file),
			codex_prefix: codex_configuration.includes(expected_prefix),
			codex_phase: codex_configuration.includes("--review-phase") && codex_configuration.includes("cleanup"),
		}).toEqual({
			codex_file: true,
			codex_prefix: true,
			codex_phase: true,
		});
	});

	test("keeps shell metacharacters literal in the Claude hook command", async () => {
		const claude_process = new RecordingProcess();
		const claude_agent = new ClaudeReviewAgent(claude_process);
		await claude_agent.run_async(METACHARACTER_REQUEST);
		let claude_configuration = "";
		const configured_claude = claude_process.arguments_list[10];
		if (configured_claude !== undefined) {
			claude_configuration = configured_claude;
		}
		const expected_file = "agent'\\\"'\\\"'s-hooks.ts";
		const expected_prefix = "'review-$(touch injected)-'";
		expect({
			claude_file: claude_configuration.includes(expected_file),
			claude_prefix: claude_configuration.includes(expected_prefix),
			claude_phase: claude_configuration.includes("--review-phase") && claude_configuration.includes("cleanup"),
		}).toEqual({ claude_file: true, claude_prefix: true, claude_phase: true });
	});

	test("delivers the rendered prompt through the real Codex catalog", async () => {
		const process = new RecordingProcess();
		const catalog = new ReviewAgentCatalog([new CodexReviewAgent(process)], new NodeFileIO());
		const request: ReviewAgentRequest = {
			root: "/project",
			instruction: "DIRECT REVIEW INSTRUCTION",
			review_root: "/project/.ai-code-guard/review",
			hook: {
				hook_file: "/project/.ai-code-guard/agent-hooks.ts",
				hook_command: "/tools/tsx",
				review_prefix: "review-boundaries-",
				review_phase: "initial",
			},
			review_stage: "boundaries",
			review_stage_plan: "boundaries: review-boundaries-",
			open_review_files: [],
			prompt: "",
		};
		const expected_prompt = catalog.prompt({ prompt_request: request });
		await catalog.run_async("codex", { run_request: request });
		expect(expected_prompt.length).toBeGreaterThan(0);
		expect(process.arguments_list.at(-1)).toBe(expected_prompt);
	});

	test("delivers the rendered prompt through the real Claude catalog", async () => {
		const process = new RecordingProcess();
		const catalog = new ReviewAgentCatalog([new ClaudeReviewAgent(process)], new NodeFileIO());
		const request: ReviewAgentRequest = {
			root: "/project",
			instruction: "DIRECT REVIEW INSTRUCTION",
			review_root: "/project/.ai-code-guard/review",
			hook: {
				hook_file: "/project/.ai-code-guard/agent-hooks.ts",
				hook_command: "/tools/tsx",
				review_prefix: "review-boundaries-",
				review_phase: "initial",
			},
			review_stage: "boundaries",
			review_stage_plan: "boundaries: review-boundaries-",
			open_review_files: [],
			prompt: "",
		};
		const expected_prompt = catalog.prompt({ prompt_request: request });
		await catalog.run_async("claude", { run_request: request });
		expect(expected_prompt.length).toBeGreaterThan(0);
		expect(process.arguments_list.at(-1)).toBe(expected_prompt);
	});

	test("does not run another provider when the selected provider fails", async () => {
		const codex = new StubReviewAgent("codex", true, 1, "codex failed");
		const claude = new StubReviewAgent("claude", true, 0, "review completed");
		const runner = new ReviewAgentCatalog([codex, claude], new NodeFileIO());
		const result = await runner.run_async("codex", {
			run_request: {
				root: "/project",
				instruction: "DIRECT REVIEW INSTRUCTION",
				review_root: "/project/.ai-code-guard/review",
				hook: {
					hook_file: "/project/.ai-code-guard/agent-hooks.ts",
					hook_command: "/tools/tsx",
					review_prefix: "review-boundaries-",
					review_phase: "initial",
				},
				review_stage: "boundaries",
				review_stage_plan: "boundaries: review-boundaries-",
				open_review_files: [],
				prompt: "",
			},
		});
		expect({
			provider: result.provider,
			codex_called: codex.request_was_received,
			claude_called: claude.request_was_received,
		}).toEqual({
			provider: "none",
			codex_called: true,
			claude_called: false,
		});
	});

	test("does not fall back when Codex is explicitly selected", async () => {
		const codex = new StubReviewAgent("codex", true, 1, "codex failed");
		const claude = new StubReviewAgent("claude", true, 0, "review completed");
		const runner = new ReviewAgentCatalog([codex, claude], new NodeFileIO());
		const result = await runner.run_async("codex", {
			run_request: {
				root: "/project",
				instruction: "DIRECT REVIEW INSTRUCTION",
				review_root: "/project/.ai-code-guard/review",
				hook: {
					hook_file: "/project/.ai-code-guard/agent-hooks.ts",
					hook_command: "/tools/tsx",
					review_prefix: "review-boundaries-",
					review_phase: "initial",
				},
				review_stage: "boundaries",
				review_stage_plan: "boundaries: review-boundaries-",
				open_review_files: [],
				prompt: "",
			},
		});
		expect({ provider: result.provider, claude_called: claude.request_was_received }).toEqual({
			provider: "none",
			claude_called: false,
		});
	});

	test("reports completion without a marker", async () => {
		const exact = new ReviewAgentCatalog([new StubReviewAgent("codex", true, 0, "review completed")], new NodeFileIO());
		const incidental = new ReviewAgentCatalog(
			[new StubReviewAgent("codex", true, 0, "review completed with no findings")],
			new NodeFileIO(),
		);
		const request: ReviewAgentRequest = {
			root: "/project",
			instruction: "DIRECT REVIEW INSTRUCTION",
			review_root: "/project/.ai-code-guard/review",
			hook: {
				hook_file: "/project/.ai-code-guard/agent-hooks.ts",
				hook_command: "/tools/tsx",
				review_prefix: "review-boundaries-",
				review_phase: "initial",
			},
			review_stage: "boundaries",
			review_stage_plan: "boundaries: review-boundaries-",
			open_review_files: [],
			prompt: "",
		};
		expect({
			exact: (await exact.run_async("codex", { run_request: request })).no_issues,
			incidental: (await incidental.run_async("codex", { run_request: request })).no_issues,
		}).toEqual({
			exact: false,
			incidental: false,
		});
	});

	test("includes the instruction and output paths in the prompt", () => {
		const runner = new ReviewAgentCatalog([], new NodeFileIO());
		const prompt = runner.prompt({
			prompt_request: {
				root: "/project",
				instruction: "DIRECT REVIEW INSTRUCTION",
				review_root: "/project/.ai-code-guard/review",
				hook: {
					hook_file: "/project/.ai-code-guard/agent-hooks.ts",
					hook_command: "/tools/tsx",
					review_prefix: "review-boundaries-",
					review_phase: "initial",
				},
				review_stage: "boundaries",
				review_stage_plan: "boundaries: review-boundaries-",
				open_review_files: [],
				prompt: "",
			},
		});
		expect({
			instruction: prompt.includes("You are an independent architecture-review agent."),
			preamble_values: prompt.includes("Working directory: /project") && prompt.includes("review-boundaries-"),
			unrendered_preamble: !prompt.includes("{{REVIEW_PREFIX}}"),
			instruction_path: !prompt.includes("architecture-review-agent.md"),
			review: prompt.includes("/project/.ai-code-guard/review"),
			stage_name_hidden: !prompt.includes("Current review stage") && !prompt.includes("boundaries: review-boundaries-"),
			read_only: prompt.includes("Do not modify") && prompt.includes("source code"),
		}).toEqual({
			instruction: true,
			preamble_values: true,
			unrendered_preamble: true,
			instruction_path: true,
			review: true,
			stage_name_hidden: true,
			read_only: true,
		});
	});

	test("includes every open review file in the cleanup prompt", () => {
		const runner = new ReviewAgentCatalog([], new NodeFileIO());
		const prompt = runner.cleanup_prompt({
			cleanup_request: {
				root: "/project",
				instruction: "DIRECT REVIEW INSTRUCTION",
				review_root: "/project/.ai-code-guard/review",
				hook: {
					hook_file: "/project/.ai-code-guard/agent-hooks.ts",
					hook_command: "/tools/tsx",
					review_prefix: "review-boundaries-",
					review_phase: "initial",
				},
				review_stage: "boundaries",
				review_stage_plan: "boundaries: review-boundaries-",
				open_review_files: ["/project/.ai-code-guard/review/first.md", "/project/.ai-code-guard/review/second.md"],
				prompt: "",
			},
		});

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
