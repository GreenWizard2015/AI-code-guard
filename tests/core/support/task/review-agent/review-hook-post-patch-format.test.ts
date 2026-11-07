import "src/core/lint_project_context_creator";
import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { AgentHookApplication } from "src/core/support/task/review-agent/agent_hook_application";
import { ReviewHookFilePolicyFixture } from "tests/bridge/ts/core/support/task/review-agent/review-hook-file-policy-fixture";
import { HOOK_TOOL_CONTEXT } from "tests/core/constants";

describe("review finding patch format", () => {
	test("reports an unsupported severity after an apply_patch update", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-patch-update");
		fixture.initialize(new Map());
		const { _root, _io } = fixture;
		const application = new AgentHookApplication(_io, _root);
		const file = join(fixture.review_root(), "review-boundaries-update.md");
		_io.file(file).write_text(fixture.review_document().replace("Severity: Major", "Severity: Critical"));
		const payload = {
			...fixture.payload(_root, "apply_patch", {
				...HOOK_TOOL_CONTEXT,
				command: "",
				file_path: "",
				path: "",
				patch: `*** Begin Patch\n*** Update File: ${file}\n*** End Patch`,
			}),
			event: "PostToolUse",
			hook_event_name: "PostToolUse",
		};
		const response = application.response({ payload, decision: { allowed: true, reason: "" } });

		expect(response).toContain(`${file}: Missing required fields: Severity (use High, Major, or Medium)`);
	});

	test("reports missing fields after an apply_patch add sent as command", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-patch-add");
		fixture.initialize(new Map());
		const { _root, _io } = fixture;
		const application = new AgentHookApplication(_io, _root);
		const file = join(fixture.review_root(), "review-boundaries-add.md");
		_io.file(file).write_text("# Incomplete finding\nStatus: Open\n");
		const command = `*** Begin Patch\n*** Add File: ${file}\n*** End Patch`;
		const payload = {
			...fixture.payload(_root, "apply_patch", {
				...HOOK_TOOL_CONTEXT,
				command,
				file_path: "",
				path: "",
				patch: "",
			}),
			event: "PostToolUse",
			hook_event_name: "PostToolUse",
		};
		const response = application.response({ payload, decision: { allowed: true, reason: "" } });

		expect(response).toContain(`${file}: Missing required fields: Severity (use High, Major, or Medium), Task`);
	});
});
