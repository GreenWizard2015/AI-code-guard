import "src/core/lint_project_context_creator";
import { describe, expect, test } from "@jest/globals";
import { AgentHookApplication } from "src/core/support/task/review-agent/agent_hook_application";
import { ReviewHookFilePolicyFixture } from "tests/bridge/ts/core/support/task/review-agent/review-hook-file-policy-fixture";
import { HOOK_TOOL_CONTEXT } from "tests/core/constants";

describe("review hook read policy", () => {
	test("confines native reads to the project, including symlink paths", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-read");
		fixture.initialize(new Map());
		const { _root, _io } = fixture;
		const application = new AgentHookApplication(_io, _root);
		const outside_root = "/virtual/outside-project";
		_io.create_directory(outside_root);
		_io.file(`${outside_root}/private.txt`).write_text("private\n");
		_io.create_symbolic_link(`${_root}/linked`, outside_root);
		const input = { ...HOOK_TOOL_CONTEXT, command: "", file_path: "/etc/passwd", path: "", patch: "" };
		const outside = application.decision(fixture.payload(_root, "Read", input)).allowed;
		const inside = application.decision(
			fixture.payload(_root, "Read", { ...input, file_path: "package.json" }),
		).allowed;
		const symlink = application.decision(
			fixture.payload(_root, "Read", { ...input, file_path: "linked/private.txt" }),
		).allowed;

		expect({ outside, inside, symlink }).toEqual({ outside: false, inside: true, symlink: false });
	});

	test("rejects nested shell commands and local Bash executables", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-shell");
		fixture.initialize(new Map());
		const { _root } = fixture;
		const application = new AgentHookApplication(fixture._io, _root);
		const input = { ...HOOK_TOOL_CONTEXT, file_path: "", path: "", patch: "" };
		const local_shell = application.decision(
			fixture.payload(_root, "Bash", { ...input, command: "cat package.json", shell: "tools/bash" }),
		).allowed;
		const nested_shell = application.decision(
			fixture.payload(_root, "Bash", { ...input, command: "/bin/bash -lc 'cat package.json'", shell: "/bin/bash" }),
		).allowed;

		expect({ local_shell, nested_shell }).toEqual({ local_shell: false, nested_shell: false });
	});
});
