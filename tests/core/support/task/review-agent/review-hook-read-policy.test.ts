import "src/core/lint_project_context_creator";
import { describe, expect, test } from "@jest/globals";
import { AgentHookApplication } from "src/core/support/task/review-agent/agent_hook_application";
import { ReviewHookFilePolicyFixture } from "tests/bridge/ts/core/support/task/review-agent/review-hook-file-policy-fixture";
import { HOOK_TOOL_CONTEXT } from "tests/core/constants";

describe("review hook read policy", () => {
	test("confines native reads to the project, including symlink paths", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-read");
		fixture.initialize(new Map());
		const { root, io } = fixture;
		const application = new AgentHookApplication(io);
		const outside_root = "/virtual/outside-project";
		io.directory_operations.create_directory(outside_root);
		io.file_content.write_text(`${outside_root}/private.txt`, "private\n");
		io.create_symbolic_link(`${root}/linked`, outside_root);
		const input = { ...HOOK_TOOL_CONTEXT, command: "", file_path: "/etc/passwd", path: "", patch: "" };
		const outside = application.decision(fixture.payload(root, "Read", input)).allowed;
		const inside = application.decision(fixture.payload(root, "Read", { ...input, file_path: "package.json" })).allowed;
		const symlink = application.decision(
			fixture.payload(root, "Read", { ...input, file_path: "linked/private.txt" }),
		).allowed;

		expect({ outside, inside, symlink }).toEqual({ outside: false, inside: true, symlink: false });
	});

	test("rejects nested shell commands and local Bash executables", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-shell");
		fixture.initialize(new Map());
		const { root } = fixture;
		const application = new AgentHookApplication(fixture.io);
		const input = { ...HOOK_TOOL_CONTEXT, file_path: "", path: "", patch: "" };
		const local_shell = application.decision(
			fixture.payload(root, "Bash", { ...input, command: "cat package.json", shell: "tools/bash" }),
		).allowed;
		const nested_shell = application.decision(
			fixture.payload(root, "Bash", { ...input, command: "/bin/bash -lc 'cat package.json'", shell: "/bin/bash" }),
		).allowed;

		expect({ local_shell, nested_shell }).toEqual({ local_shell: false, nested_shell: false });
	});
});
