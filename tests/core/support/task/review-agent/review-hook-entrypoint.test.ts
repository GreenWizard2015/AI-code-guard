import "src/core/lint_project_context_creator";
import { describe, expect, test } from "@jest/globals";
import { AgentHookApplication } from "src/core/support/task/review-agent/agent_hook_application";
import { HookPayloadNormalizer } from "src/core/support/task/review-agent/hook_payload_normalizer";
import type { RawHookPayload } from "src/core/support/task/review-agent/types";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { HOOK_TOOL_CONTEXT, PROJECT_ROOT } from "tests/core/constants";

describe("review hook payload normalization", () => {
	test("uses the configured prefix for a Codex finding write", () => {
		const raw: RawHookPayload = {
			event: "PreToolUse",
			hook_event_name: "PreToolUse",
			stop_hook_active: false,
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
		};
		const normalizer = new HookPayloadNormalizer("review-algorithms-", Number.POSITIVE_INFINITY);
		const io = new InMemoryFileIO();
		io.create_directory(PROJECT_ROOT);
		const application = new AgentHookApplication(io, PROJECT_ROOT);
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
			stop_hook_active: false,
			tool_name: "command_execution",
			tool_input: { ...HOOK_TOOL_CONTEXT, command: "", cmd: "pwd", file_path: "", path: "", patch: "" },
			cwd: PROJECT_ROOT,
			review_stage: "tests",
			review_prefix: "wrong-prefix-",
		};
		const normalizer = new HookPayloadNormalizer("review-tests-", Number.POSITIVE_INFINITY);
		const io = new InMemoryFileIO();
		io.create_directory(PROJECT_ROOT);
		const application = new AgentHookApplication(io, PROJECT_ROOT);
		const payload = normalizer.normalize(raw);
		const decision = application.decision(payload);

		expect({ tool: payload.tool_name, command: payload.tool_input.command, allowed: decision.allowed }).toEqual({
			tool: "Bash",
			command: "pwd",
			allowed: true,
		});
	});

	test("preserves and authorizes the command execution context", () => {
		const normalizer = new HookPayloadNormalizer("review-boundaries-", Number.POSITIVE_INFINITY);
		const payload = normalizer.normalize({
			event: "PreToolUse",
			hook_event_name: "PreToolUse",
			stop_hook_active: false,
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
		});
		const io = new InMemoryFileIO();
		io.create_directory(PROJECT_ROOT);
		const application = new AgentHookApplication(io, PROJECT_ROOT);
		const decision = application.decision(payload);

		expect({
			workdir: payload.tool_input.workdir,
			shell: payload.tool_input.shell,
			login: payload.tool_input.login,
			allowed: decision.allowed,
		}).toEqual({ workdir: "src", shell: "/bin/bash", login: false, allowed: true });
	});

	test("allows bare pwd without an active review prefix", () => {
		const normalizer = new HookPayloadNormalizer("", Number.POSITIVE_INFINITY);
		const io = new InMemoryFileIO();
		io.create_directory(PROJECT_ROOT);
		const application = new AgentHookApplication(io, PROJECT_ROOT);
		const payload = normalizer.normalize({
			event: "PreToolUse",
			hook_event_name: "PreToolUse",
			stop_hook_active: false,
			tool_name: "command_execution",
			tool_input: { ...HOOK_TOOL_CONTEXT, command: "", cmd: "pwd", file_path: "", path: "", patch: "" },
			cwd: "",
			review_stage: "",
			review_prefix: "",
		});

		expect(application.decision(payload)).toEqual({ allowed: true, reason: "" });
	});

	test("accepts the official apply_patch payload with only command", () => {
		const raw: RawHookPayload = {
			event: "PreToolUse",
			hook_event_name: "PreToolUse",
			stop_hook_active: false,
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
		};
		const normalizer = new HookPayloadNormalizer("review-abstractions-", Number.POSITIVE_INFINITY);
		const io = new InMemoryFileIO();
		io.create_directory(PROJECT_ROOT);
		const application = new AgentHookApplication(io, PROJECT_ROOT);
		const payload = normalizer.normalize(raw);
		const decision = application.decision(payload);

		expect({ command: payload.tool_input.command, allowed: decision.allowed }).toEqual({
			command: payload.tool_input.command,
			allowed: true,
		});
	});

	test("normalizes a payload with omitted optional fields", () => {
		const normalizer = new HookPayloadNormalizer("review-contract-", Number.POSITIVE_INFINITY);
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

	test("preserves the provider stop-continuation state", () => {
		const normalizer = new HookPayloadNormalizer("review-contract-", Number.POSITIVE_INFINITY);
		const normalized = normalizer.normalize(
			JSON.parse('{"event":"Stop","hook_event_name":"Stop","stop_hook_active":true}'),
		);

		expect(normalized.stop_hook_active).toBe(true);
	});

	test("uses the trusted review start timestamp for the finding cutoff", () => {
		const normalizer = new HookPayloadNormalizer("review-contract-", 1234);
		const normalized = normalizer.normalize(
			JSON.parse('{"event":"PostToolUse","tool_name":"Write","review_start_ms":1}'),
		);

		expect(normalized.review_start_ms).toBe(1234);
	});
});
