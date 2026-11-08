import "src/core/lint_project_context_creator";
import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { AgentHookApplication } from "src/core/support/task/review-agent/agent_hook_application";
import { ReviewHookFilePolicyFixture } from "tests/bridge/ts/core/support/task/review-agent/review-hook-file-policy-fixture";
import { HOOK_TOOL_CONTEXT } from "tests/core/constants";

describe("review hook file operations", () => {
	test("denies review-agent tools access to archived review files", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-resolved-access");
		fixture.initialize(new Map());
		const resolved_root = join(fixture._root, ".ai-code-guard", "resolved-review");
		fixture._io.create_directory(resolved_root);
		const resolved_file = join(resolved_root, "finding.md");
		fixture._io.file(resolved_file).write_text("Status: Resolved\n");
		const application = new AgentHookApplication(fixture._io, fixture._root);
		const read_file = application.decision(
			fixture.payload(fixture._root, "Read", {
				...HOOK_TOOL_CONTEXT,
				command: "",
				file_path: resolved_file,
				path: "",
				patch: "",
			}),
		);
		const recursive_glob = application.decision(
			fixture.payload(fixture._root, "Glob", {
				...HOOK_TOOL_CONTEXT,
				command: "",
				file_path: fixture._root,
				path: "",
				patch: "",
			}),
		);

		expect({ read_file: read_file.allowed, recursive_glob: recursive_glob.allowed }).toEqual({
			read_file: false,
			recursive_glob: false,
		});
	});

	test("denies deleting regular and resolved findings", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-deletion");
		fixture.initialize(
			new Map([
				["review-boundaries-open.md", "# Finding\n"],
				["review-boundaries-resolved.md", "# Finding\nStatus: Resolved\n"],
			]),
		);
		const { _root, _io } = fixture;
		const application = new AgentHookApplication(_io, _root);
		const directory = fixture.review_root();
		const finding = join(directory, "review-boundaries-open.md");
		const resolved = join(directory, "review-boundaries-resolved.md");
		const deletion_input = { ...HOOK_TOOL_CONTEXT, command: `/bin/rm ${finding}`, file_path: "", path: "", patch: "" };
		const regular_finding = application.decision({
			...fixture.payload(_root, "Bash", deletion_input),
		}).allowed;
		const resolved_finding = application.decision({
			...fixture.payload(_root, "Bash", { ...deletion_input, command: `/bin/rm ${resolved}` }),
		}).allowed;

		expect({ regular_finding, resolved_finding }).toEqual({ regular_finding: false, resolved_finding: false });
	});

	test("allows removing an oversized finding after splitting", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-oversized-split");
		fixture.initialize(
			new Map([["review-boundaries-large.md", Array.from({ length: 31 }, () => "finding").join("\n")]]),
		);
		const { _root, _io } = fixture;
		const application = new AgentHookApplication(_io, _root);
		const large_finding = join(fixture.review_root(), "review-boundaries-large.md");
		const allowed = application.decision({
			...fixture.payload(_root, "Bash", {
				...HOOK_TOOL_CONTEXT,
				command: `/bin/rm ${large_finding}`,
				file_path: "",
				path: "",
				patch: "",
			}),
		}).allowed;

		expect(allowed).toBe(true);
	});

	test("rejects project-local shell executables for review operations", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-local-rm");
		fixture.initialize(new Map());
		const { _root, _io } = fixture;
		const application = new AgentHookApplication(_io, _root);
		const finding = join(fixture.review_root(), "review-boundaries-open.md");
		_io.create_directory(fixture.review_root());
		_io.file(finding).write_text("# Finding\n");
		const untrusted_command = application.decision(
			fixture.payload(_root, "Bash", {
				...HOOK_TOOL_CONTEXT,
				command: `${join(_root, "tools", "rm")} ${finding}`,
				file_path: "",
				path: "",
				patch: "",
			}),
		).allowed;

		expect(untrusted_command).toBe(false);
	});

	test("reports progress after an oversized finding is written", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-oversized-progress");
		fixture.initialize(new Map());
		const { _root, _io } = fixture;
		const application = new AgentHookApplication(_io, _root);
		const directory = fixture.review_root();
		_io.create_directory(directory);
		_io.file(join(directory, "review-boundaries-open.md")).write_text("# Finding\n");
		_io.file(join(directory, "review-boundaries-second.md")).write_text("# Second\n");
		_io.file(join(directory, "review-boundaries-resolved.md")).write_text("# Finding\nStatus: Resolved\n");
		const oversized = join(directory, "review-boundaries-oversized.md");
		_io.file(oversized).write_text(Array.from({ length: 31 }, () => "finding").join("\n"));
		_io.file(join(directory, "review-complete.md")).write_text("complete\n");
		const response = application.response({
			payload: {
				...fixture.payload(_root, "Write", {
					...HOOK_TOOL_CONTEXT,
					command: "",
					file_path: oversized,
					path: "",
					patch: "",
				}),
				event: "PostToolUse",
				hook_event_name: "PostToolUse",
			},
			decision: { allowed: true, reason: "" },
		});

		expect({
			progress: response.includes("Defects remaining to find: 6."),
			guidance: response.includes("Split it in the review directory"),
			algorithm_review: response.includes("algorithmic complexity"),
			abstraction_review: response.includes("domain objects"),
		}).toEqual({ progress: true, guidance: true, algorithm_review: true, abstraction_review: true });
	});

	test("clamps remaining finding progress at zero", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-progress");
		fixture.initialize(new Map());
		const { _root, _io } = fixture;
		const application = new AgentHookApplication(_io, _root);
		const directory = fixture.review_root();
		_io.create_directory(directory);
		for (let index = 0; index < 11; index += 1) {
			_io.file(join(directory, `review-boundaries-finding-${index}.md`)).write_text("# Finding\n");
		}
		const response = application.response({
			payload: {
				...fixture.payload(_root, "Write", {
					...HOOK_TOOL_CONTEXT,
					command: "",
					file_path: "not-a-review-file",
					path: "",
					patch: "",
				}),
				event: "PostToolUse",
				hook_event_name: "PostToolUse",
			},
			decision: { allowed: true, reason: "" },
		});

		expect(response).toContain("Defects remaining to find: 0.");
	});
});
