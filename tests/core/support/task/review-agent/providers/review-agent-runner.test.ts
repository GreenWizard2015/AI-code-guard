import { describe, expect, test } from "@jest/globals";
import { ClaudeReviewAgent } from "src/core/support/task/review-agent/providers/claude_review_agent";
import { CodexReviewAgent } from "src/core/support/task/review-agent/providers/codex_review_agent";
import { ReviewAgentCatalog } from "src/core/support/task/review-agent/providers/review_agent_catalog";
import { NodeFileIO } from "src/io/node_file_io";
import { METACHARACTER_REQUEST, REVIEW_PROMPT } from "tests/bridge/ts/core/constants";
import { RecordingProcess } from "tests/bridge/ts/core/recording-review-process";
import { StubReviewAgent } from "tests/bridge/ts/core/review-agent/stub-review-agent";
import {
	CATALOG_REVIEW_REQUEST,
	CLEANUP_REVIEW_REQUEST,
	REVIEW_REQUEST,
} from "tests/core/support/task/review-agent/providers/constants";

describe("review-agent runner", () => {
	test("builds a hook-controlled Codex command with the project paths", async () => {
		const process = new RecordingProcess();
		const agent = new CodexReviewAgent(process);
		await agent.run_async(REVIEW_REQUEST);
		const process_snapshot = process.run_snapshot();
		const process_arguments = [...process_snapshot.arguments_list];
		const hook_argument_index = process_arguments.indexOf("-c");
		const hook_configuration = process_arguments[hook_argument_index + 1] ?? "";
		expect({
			command: process_snapshot.command,
			root: process_snapshot.root,
			arguments: process_arguments.slice(0, 11),
			prompt: process_arguments[12],
			hooks_configured: hook_configuration.includes("PreToolUse"),
			pre_tool_use_matches_all_tools: hook_configuration.includes('PreToolUse=[{matcher=".*"'),
			prefix_configured:
				hook_configuration.includes("--review-prefix") && hook_configuration.includes("review-boundaries-"),
			phase_configured: hook_configuration.includes("--review-phase") && hook_configuration.includes("initial"),
			start_time_configured: hook_configuration.includes("--review-started-at") && hook_configuration.includes("0"),
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
			prompt: REVIEW_PROMPT,
			hooks_configured: true,
			pre_tool_use_matches_all_tools: true,
			prefix_configured: true,
			phase_configured: true,
			start_time_configured: true,
		});
	});

	test("builds a Claude command with review-only tools", async () => {
		const process = new RecordingProcess();
		const agent = new ClaudeReviewAgent(process);
		await agent.run_async(REVIEW_REQUEST);
		const process_snapshot = process.run_snapshot();
		const process_arguments = [...process_snapshot.arguments_list];
		const settings_argument = process_arguments[10];
		const settings_configured = settings_argument?.includes("PreToolUse") === true;
		const pre_tool_use_matches_all_tools = settings_argument?.includes('"matcher":".*"') === true;
		expect({
			command: process_snapshot.command,
			arguments: process_arguments.slice(0, 10),
			prompt: process_arguments[11],
			settings_configured: process_arguments.includes("--settings") && settings_configured,
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
			prompt: REVIEW_PROMPT,
			settings_configured: true,
			pre_tool_use_matches_all_tools: true,
		});
	});

	test("keeps shell metacharacters literal in the Codex hook command", async () => {
		const codex_process = new RecordingProcess();
		const codex_agent = new CodexReviewAgent(codex_process);
		await codex_agent.run_async(METACHARACTER_REQUEST);
		const codex_snapshot = codex_process.run_snapshot();
		const codex_arguments = [...codex_snapshot.arguments_list];
		const codex_configuration_index = codex_arguments.indexOf("-c") + 1;
		let codex_configuration = "";
		const configured_codex = codex_arguments[codex_configuration_index];
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
		const claude_snapshot = claude_process.run_snapshot();
		const claude_arguments = [...claude_snapshot.arguments_list];
		const configured_claude = claude_arguments[10];
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
		const catalog = new ReviewAgentCatalog([new CodexReviewAgent(process)], new NodeFileIO("/project"));
		const expected_prompt = catalog.prompt({ prompt_request: CATALOG_REVIEW_REQUEST });
		await catalog.run_async("codex", { run_request: CATALOG_REVIEW_REQUEST });
		const process_snapshot = process.run_snapshot();
		const process_arguments = [...process_snapshot.arguments_list];
		const prompt_argument = process_arguments.at(-1);
		expect(expected_prompt.length).toBeGreaterThan(0);
		expect(prompt_argument).toBe(expected_prompt);
	});

	test("delivers the rendered prompt through the real Claude catalog", async () => {
		const process = new RecordingProcess();
		const catalog = new ReviewAgentCatalog([new ClaudeReviewAgent(process)], new NodeFileIO("/project"));
		const expected_prompt = catalog.prompt({ prompt_request: CATALOG_REVIEW_REQUEST });
		await catalog.run_async("claude", { run_request: CATALOG_REVIEW_REQUEST });
		const process_snapshot = process.run_snapshot();
		const process_arguments = [...process_snapshot.arguments_list];
		const prompt_argument = process_arguments.at(-1);
		expect(expected_prompt.length).toBeGreaterThan(0);
		expect(prompt_argument).toBe(expected_prompt);
	});

	test("renders cleanup as a separate review dialogue", () => {
		const catalog = new ReviewAgentCatalog([], new NodeFileIO("/project"));
		const prompt = catalog.cleanup_prompt({ cleanup_request: CLEANUP_REVIEW_REQUEST });

		expect(prompt).toContain("architecture review");
	});

	test("does not run another provider when the selected provider fails", async () => {
		const codex = new StubReviewAgent("codex", true, 1, "codex failed");
		const claude = new StubReviewAgent("claude", true, 0, "review completed");
		const runner = new ReviewAgentCatalog([codex, claude], new NodeFileIO(process.cwd()));
		const result = await runner.run_async("codex", { run_request: CATALOG_REVIEW_REQUEST });
		expect({
			provider: result.provider,
			codex_called: codex.request_was_received(),
			claude_called: claude.request_was_received(),
		}).toEqual({
			provider: "none",
			codex_called: true,
			claude_called: false,
		});
	});

	test("reports completion without a marker", async () => {
		const exact = new ReviewAgentCatalog(
			[new StubReviewAgent("codex", true, 0, "review completed")],
			new NodeFileIO(process.cwd()),
		);
		const incidental = new ReviewAgentCatalog(
			[new StubReviewAgent("codex", true, 0, "review completed with no findings")],
			new NodeFileIO(process.cwd()),
		);
		expect({
			exact: (await exact.run_async("codex", { run_request: CATALOG_REVIEW_REQUEST })).no_issues,
			incidental: (await incidental.run_async("codex", { run_request: CATALOG_REVIEW_REQUEST })).no_issues,
		}).toEqual({
			exact: false,
			incidental: false,
		});
	});
});
