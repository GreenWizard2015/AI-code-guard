import "src/core/lint_project_context_creator";
import { describe, expect, test } from "@jest/globals";
import { AgentHookApplication } from "src/core/support/task/review-agent/agent_hook_application";
import { HookPayloadNormalizer } from "src/core/support/task/review-agent/hook_payload_normalizer";
import type { RawHookPayload } from "src/core/support/task/review-agent/types";
import { NodeFileIO } from "src/io/node_file_io";
import { HOOK_TOOL_CONTEXT, PROJECT_ROOT } from "tests/core/constants";

describe("review hook payload normalization", () => {
	test("uses the configured prefix for a Codex finding write", () => {
		const raw: RawHookPayload = {
			event: "PreToolUse",
			hook_event_name: "PreToolUse",
			tool_name: "Write",
			tool_input: {
				...HOOK_TOOL_CONTEXT,
				command: "",
				cmd: "",
				file_path: ".ai-code-guard/review/review-algorithms-finding.md",
				path: "",
				patch: "",
			},
			cwd: PROJECT_ROOT,
			review_stage: "algorithms",
			review_prefix: "wrong-prefix-",
			review_phase: "initial",
		};
		const normalizer = new HookPayloadNormalizer("review-algorithms-");
		const application = new AgentHookApplication(new NodeFileIO());
		const payload = normalizer.normalize(raw);
		const decision = application.decision(payload);

		expect({ prefix: payload.review_prefix, allowed: decision.allowed }).toEqual({
			prefix: "review-algorithms-",
			allowed: true,
		});
	});

	test("normalizes Codex command_execution input for read policy", () => {
		const raw: RawHookPayload = {
			event: "PreToolUse",
			hook_event_name: "PreToolUse",
			tool_name: "command_execution",
			tool_input: { ...HOOK_TOOL_CONTEXT, command: "", cmd: "pwd", file_path: "", path: "", patch: "" },
			cwd: PROJECT_ROOT,
			review_stage: "tests",
			review_prefix: "wrong-prefix-",
			review_phase: "initial",
		};
		const normalizer = new HookPayloadNormalizer("review-tests-");
		const application = new AgentHookApplication(new NodeFileIO());
		const payload = normalizer.normalize(raw);
		const decision = application.decision(payload);

		expect({ tool: payload.tool_name, command: payload.tool_input.command, allowed: decision.allowed }).toEqual({
			tool: "Bash",
			command: "pwd",
			allowed: true,
		});
	});

	test("preserves and authorizes the command execution context", () => {
		const normalizer = new HookPayloadNormalizer("review-boundaries-");
		const payload = normalizer.normalize({
			event: "PreToolUse",
			hook_event_name: "PreToolUse",
			tool_name: "command_execution",
			tool_input: {
				command: "",
				cmd: "cat ../package.json",
				file_path: "",
				path: "",
				patch: "",
				workdir: "src",
				shell: "/bin/bash",
				login: false,
			},
			cwd: PROJECT_ROOT,
			review_stage: "boundaries",
			review_prefix: "review-boundaries-",
			review_phase: "initial",
		});
		const application = new AgentHookApplication(new NodeFileIO());
		const decision = application.decision(payload);

		expect({
			workdir: payload.tool_input.workdir,
			shell: payload.tool_input.shell,
			login: payload.tool_input.login,
			allowed: decision.allowed,
		}).toEqual({ workdir: "src", shell: "/bin/bash", login: false, allowed: true });
	});

	test("allows bare pwd without an active review prefix", () => {
		const normalizer = new HookPayloadNormalizer("");
		const application = new AgentHookApplication(new NodeFileIO());
		const payload = normalizer.normalize({
			event: "PreToolUse",
			hook_event_name: "PreToolUse",
			tool_name: "command_execution",
			tool_input: { ...HOOK_TOOL_CONTEXT, command: "", cmd: "pwd", file_path: "", path: "", patch: "" },
			cwd: "",
			review_stage: "",
			review_prefix: "",
			review_phase: "initial",
		});

		expect(application.decision(payload)).toEqual({ allowed: true, reason: "" });
	});

	test("accepts the official apply_patch payload with only command", () => {
		const raw: RawHookPayload = {
			event: "PreToolUse",
			hook_event_name: "PreToolUse",
			tool_name: "apply_patch",
			tool_input: {
				...HOOK_TOOL_CONTEXT,
				command: "*** Begin Patch\n*** Add File: .ai-code-guard/review/review-abstractions-finding.md\n*** End Patch",
				cmd: "",
				file_path: "",
				path: "",
				patch: "",
			},
			cwd: PROJECT_ROOT,
			review_stage: "abstractions",
			review_prefix: "review-abstractions-",
			review_phase: "initial",
		};
		const normalizer = new HookPayloadNormalizer("review-abstractions-");
		const application = new AgentHookApplication(new NodeFileIO());
		const payload = normalizer.normalize(raw);
		const decision = application.decision(payload);

		expect({ command: payload.tool_input.command, allowed: decision.allowed }).toEqual({
			command: payload.tool_input.command,
			allowed: true,
		});
	});

	test("normalizes a payload with omitted optional fields", () => {
		const normalizer = new HookPayloadNormalizer("review-contract-");
		const normalized = normalizer.normalize(JSON.parse('{"event":"PreToolUse","tool_name":"Bash"}'));

		expect({
			tool_name: normalized.tool_name,
			command: normalized.tool_input.command,
			cwd: normalized.cwd,
			review_prefix: normalized.review_prefix,
		}).toEqual({
			tool_name: "Bash",
			command: "",
			cwd: "",
			review_prefix: "review-contract-",
		});
	});
});
